/**
 * designer.js - UE5 Blueprint 风格故事设计器
 * 《无心之举 / Unintended Reply》
 * 可视化节点编辑 · 引脚连接 · 变量系统 · 执行流
 */

const DESIGNER = (function() {
    'use strict';

    // ==================== 状态 ====================
    let currentDesign = null;
    let nodeIdCounter = 0;
    let connIdCounter = 0;
    let selectedNodeId = null;
    let nextNodeId = 0;

    // 拖拽/连接状态
    let dragNode = null;
    let dragOffset = { x: 0, y: 0 };
    let panning = false;
    let panStart = { x: 0, y: 0 };
    let canvasOffset = { x: 0, y: 0 };
    let scale = 1;
    let tempConnection = null; // 临时连接（从引脚拖出）
    let _connectionPicker = null; // 连接选择器引用
    let _rafId = null; // requestAnimationFrame ID（用于节流）
    let _dirtyConnections = false; // 标记连线是否需要更新

    // 触摸/指针手势状态（移动端拖拽、平移、双指缩放）
    const activePointers = new Map();
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let pinchMidScreen = { x: 0, y: 0 };
    let pinchAnchorWorld = { x: 0, y: 0 };
    const isTouch = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

    // ==================== 高性能更新调度 ====================
    // 合并同一帧内的多次 updateSvgLines 调用，避免冗余的 DOM 操作
    function scheduleConnectionUpdate() {
        _dirtyConnections = true;
        if (_rafId) return; // 已有等待中的帧
        _rafId = requestAnimationFrame(() => {
            _rafId = null;
            if (_dirtyConnections) {
                _dirtyConnections = false;
                updateSvgLinesFast(); // 使用增量更新的快速版本
            }
        });
    }

    // 立即更新（用于需要同步的场景，如释放鼠标、缩放等）
    function forceUpdateConnections() {
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        _dirtyConnections = false;
        updateSvgLines();
    }

    // ==================== 引脚连接选择器 ====================
    // 当拖出引脚但未命中目标时，弹出可连接的节点列表
    function showConnectionPicker(fromPin, fromDirection, clientX, clientY) {
        closeConnectionPicker(); // 先关闭已有的

        const picker = document.createElement('div');
        picker.id = 'bp-connection-picker';
        picker.className = 'bp-connection-picker';

        // 确定要查找的目标方向和类型
        const targetDirection = fromDirection === 'output' ? 'input' : 'output';
        const pinType = fromPin.type;

        // 收集所有可连接的候选目标
        const candidates = [];
        currentDesign.nodes.forEach(node => {
            if (node.id === fromPin.nodeId) return; // 排除自身
            const targetPins = targetDirection === 'input' ? node.inputs : node.outputs;
            targetPins.forEach(pin => {
                // 类型必须匹配（exec/number/string等）
                if (pin.type !== pinType) return;
                // 检查是否可以连接
                let outPin, inPin;
                if (fromDirection === 'output') { outPin = fromPin; inPin = pin; }
                else { outPin = pin; inPin = fromPin; }
                // 目标输入已有连接的也显示，允许替换
                const tpl = NODE_TEMPLATES[node.type];
                candidates.push({
                    node,
                    pin,
                    nodeId: node.id,
                    pinId: pin.id,
                    nodeTitle: getText(tpl.title, tpl.titleEn, tpl.titleJa),
                    pinName: getText(pin.name, pin.nameEn, pin.nameJa),
                    color: tpl.color,
                    alreadyConnected: currentDesign.connections.some(c => c.toNode === node.id && c.toPin === pin.id && targetDirection === 'input')
                });
            });
        });

        if (candidates.length === 0) {
            showMessage(I18N.t('noConnectableTargets') || '🔌 没有可连接的目标节点');
            return;
        }

        // 定位：在鼠标附近显示，避免超出屏幕
        const pickerWidth = 280;
        const pickerMaxHeight = 360;
        let posX = Math.min(clientX + 12, window.innerWidth - pickerWidth - 20);
        let posY = Math.min(clientY + 12, window.innerHeight - pickerMaxHeight - 20);
        if (posY < 10) posY = clientY - 60;
        if (posX < 10) posX = clientX + 20;

        picker.style.cssText = `
            position:fixed;left:${posX}px;top:${posY}px;z-index:10001;
            background:var(--bg-card);border:1px solid var(--border-color);
            border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);
            min-width:260px;max-width:${pickerWidth}px;max-height:${pickerMaxHeight}px;
            overflow-y:auto;font-family:inherit;animation:cardAppear 0.15s ease;
        `;

        // 标题栏
        const typeColor = TYPE_COLORS[pinType] || '#999';
        const directionLabel = targetDirection === 'input'
            ? (I18N.t('designerPickTarget') || '🔌 选择目标输入')
            : (I18N.t('designerPickSource') || '🔌 选择来源输出');
        
        let html = `
            <div style="padding:10px 12px 8px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px;position:sticky;top:0;background:var(--bg-card);z-index:1;">
                <span style="width:10px;height:10px;border-radius:50%;background:${typeColor};border:2px solid var(--bg-card);box-shadow:0 0 4px ${typeColor};"></span>
                <span style="font-size:0.8rem;font-weight:700;color:var(--text-primary);">${directionLabel}</span>
                <span style="font-size:0.65rem;color:var(--text-muted);margin-left:auto;background:var(--bg-primary);padding:1px 6px;border-radius:4px;">${pinType}</span>
                <button id="bp-picker-close-btn" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:0 2px;line-height:1;">✕</button>
            </div>
            <div class="bp-picker-list" style="padding:6px;">
        `;

        // 搜索框
        html += `
            <input id="bp-picker-search" placeholder="${I18N.t('designerSearchNode') || '🔍 搜索节点...'}" 
                style="width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:6px 10px;color:var(--text-primary);font-size:0.78rem;margin-bottom:6px;outline:none;box-sizing:border-box;" />
        `;

        // 候选项列表
        candidates.forEach((cand, idx) => {
            const connBadge = cand.alreadyConnected 
                ? `<span style="font-size:0.6rem;background:rgba(250,204,21,0.15);color:var(--accent-yellow);padding:1px 5px;border-radius:3px;margin-left:4px;">${I18N.t('designerReplace') || '替换'}</span>` 
                : '';
            html += `
                <div class="bp-picker-item" data-node-id="${cand.nodeId}" data-pin-id="${cand.pinId}" data-idx="${idx}"
                    style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:2px;border-radius:8px;cursor:pointer;transition:all 0.1s;">
                    <span style="width:8px;height:8px;border-radius:3px;background:${cand.color};flex-shrink:0;"></span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.78rem;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(cand.nodeTitle)}${connBadge}</div>
                        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:1px;display:flex;align-items:center;gap:4px;">
                            <span style="width:6px;height:6px;border-radius:50%;background:${typeColor};"></span>
                            ${escapeHtml(cand.pinName)}
                            <span style="color:var(--border-color);">|</span>
                            ${targetDirection === 'input' ? '⬅ 输入' : '➡ 输出'}
                        </div>
                    </div>
                    <span style="color:var(--accent-green);font-size:0.9rem;opacity:0;transition:opacity 0.15s;">✓</span>
                </div>
            `;
        });

        html += '</div>';
        // 底部提示
        html += `<div style="padding:6px 12px 10px;border-top:1px solid var(--border-color);font-size:0.65rem;color:var(--text-muted);text-align:center;position:sticky;bottom:0;background:var(--bg-card);">
            ${I18N.t('pickerHint') || '点击建立连接 · 按 Esc 关闭'}
        </div>`;

        picker.innerHTML = html;
        document.body.appendChild(picker);
        _connectionPicker = picker;

        // 绑定关闭按钮
        document.getElementById('bp-picker-close-btn').onclick = () => closeConnectionPicker();

        // 搜索过滤
        const searchInput = document.getElementById('bp-picker-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.oninput = () => {
                const query = searchInput.value.toLowerCase();
                picker.querySelectorAll('.bp-picker-item').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(query) ? '' : 'none';
                });
            };
        }

        // 候选项交互
        picker.querySelectorAll('.bp-picker-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(74,125,255,0.08)';
                item.querySelector('span:last-child').style.opacity = '1';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
                item.querySelector('span:last-child').style.opacity = '0';
            });
            item.addEventListener('click', () => {
                const toNodeId = item.dataset.nodeId;
                const toPinId = item.dataset.pinId;
                const toPin = getPinByNodeIdAndId(toNodeId, toPinId);
                if (!toPin) return;

                let outPin, inPin;
                if (fromDirection === 'output') { outPin = fromPin; inPin = toPin; }
                else { outPin = toPin; inPin = fromPin; }

                addConnection(outPin, inPin, true); // force=true 允许替换已有连接
                closeConnectionPicker();
            });
        });

        // ESC 关闭
        const onKeyEsc = (e) => {
            if (e.key === 'Escape') {
                closeConnectionPicker();
                document.removeEventListener('keydown', onKeyEsc);
            }
        };
        document.addEventListener('keydown', onKeyEsc);

        // 点击外部关闭
        setTimeout(() => {
            const onOutsideClick = (e) => {
                if (_connectionPicker && !_connectionPicker.contains(e.target)) {
                    closeConnectionPicker();
                    document.removeEventListener('pointerdown', onOutsideClick);
                }
            };
            document.addEventListener('pointerdown', onOutsideClick);
        }, 0);
    }

    function closeConnectionPicker() {
        if (_connectionPicker) {
            _connectionPicker.remove();
            _connectionPicker = null;
        }
    }

    // 颜色定义
    const TYPE_COLORS = {
        exec: '#e8e8e0',      // 执行流 - 白色/灰白
        string: '#4ade80',    // 字符串 - 绿
        number: '#60a5fa',    // 数字 - 蓝
        boolean: '#f87171',   // 布尔 - 红
        character: '#c084fc', // 角色 - 紫
        choice: '#fbbf24',    // 选择 - 黄
        any: '#9ca3af'        // 任意 - 灰
    };

    function genId(prefix) {
        return `${prefix || 'node'}_${Date.now().toString(36)}_${++nextNodeId}`;
    }

    // ==================== 默认设计 ====================
    function createDefaultDesign() {
        return {
            id: 'blueprint_' + Date.now(),
            title: '',
            description: '',
            version: 2,
            variables: {
                trust: { name: I18N.t('defaultTrustName'), nameEn: 'Trust', nameJa: '信頼度', type: 'number', defaultValue: 50 },
                courage: { name: I18N.t('defaultCourageName'), nameEn: 'Courage', nameJa: '勇気', type: 'number', defaultValue: 50 }
            },
            characters: {
                narrator: { id: 'narrator', name: I18N.t('defaultNarratorName'), nameEn: 'Narrator', nameJa: 'ナレーター', icon: '✦', color: '#8b5cf6' },
                player: { id: 'player', name: I18N.t('defaultPlayerName'), nameEn: 'Player', nameJa: 'プレイヤー', icon: '👤', color: '#4a7dff' }
            },
            nodes: [],
            connections: [],
            startNode: null
        };
    }

    // ==================== 节点模板 ====================
    const NODE_TEMPLATES = {
        event_start: {
            type: 'event_start',
            title: I18N.t('designerNodeEventStart'), titleEn: 'Game Start', titleJa: 'ゲーム開始',
            color: '#ef4444',
            inputs: [],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinOutExec'), nameEn: 'Then', nameJa: '実行', type: 'exec' }
            ],
            data: { eventName: 'GameStart' }
        },
        chapter_begin: {
            type: 'chapter_begin',
            title: I18N.t('designerNodeChapterBegin'), titleEn: 'Chapter Start', titleJa: '章開始',
            color: '#f97316',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' },
                { id: 'in_title', name: I18N.t('designerPinInTitle'), nameEn: 'Title', nameJa: 'タイトル', type: 'string' }
            ],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinOutExec'), nameEn: 'Out', nameJa: '出力', type: 'exec' }
            ],
            data: { chapterTitle: '', chapterSubtitle: '' }
        },
        dialogue: {
            type: 'dialogue',
            title: I18N.t('designerNodeDialogue'), titleEn: 'Dialogue', titleJa: '会話',
            color: '#22c55e',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' },
                { id: 'in_character', name: I18N.t('designerPinInCharacter'), nameEn: 'Character', nameJa: 'キャラ', type: 'character' }
            ],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinOutExec'), nameEn: 'Out', nameJa: '出力', type: 'exec' }
            ],
            data: { text: '', textEn: '', textJa: '' }
        },
        narration: {
            type: 'narration',
            title: I18N.t('designerNodeNarration'), titleEn: 'Narration', titleJa: 'ナレーション',
            color: '#8b5cf6',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' }
            ],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinOutExec'), nameEn: 'Out', nameJa: '出力', type: 'exec' }
            ],
            data: { text: '', textEn: '', textJa: '' }
        },
        choice: {
            type: 'choice',
            title: I18N.t('designerNodeChoice'), titleEn: 'Choice', titleJa: '選択',
            color: '#eab308',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' }
            ],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinChoice1'), nameEn: 'Choice 1', nameJa: '選択肢1', type: 'exec', tag: 'neutral' }
            ],
            data: { choices: [{ text: I18N.t('designerPinChoice1'), textEn: 'Choice 1', textJa: '選択肢1', tag: 'neutral' }] }
        },
        condition: {
            type: 'condition',
            title: I18N.t('designerNodeCondition'), titleEn: 'Condition', titleJa: '条件',
            color: '#ec4899',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' },
                { id: 'in_val', name: I18N.t('designerPinInVal'), nameEn: 'Value', nameJa: '値', type: 'number' }
            ],
            outputs: [
                { id: 'out_true', name: I18N.t('designerPinOutTrue'), nameEn: 'True', nameJa: '真', type: 'exec' },
                { id: 'out_false', name: I18N.t('designerPinOutFalse'), nameEn: 'False', nameJa: '偽', type: 'exec' }
            ],
            data: {
                operator: '>=',
                leftType: 'variable',   // 'variable' | 'direct'
                leftVariable: 'trust',
                leftDirect: 50,
                leftPinConnected: false,
                rightType: 'direct',    // 'variable' | 'direct'
                rightVariable: 'trust',
                rightDirect: 30,
                compareWith: 'direct'   // 'variable' | 'direct' | 'pin'
            }
        },
        get_variable: {
            type: 'get_variable',
            title: I18N.t('designerNodeGetVar'), titleEn: 'Get Variable', titleJa: '変数取得',
            color: '#3b82f6',
            inputs: [],
            outputs: [
                { id: 'out_value', name: I18N.t('designerPinOutValue'), nameEn: 'Value', nameJa: '値', type: 'number' }
            ],
            data: { variableName: 'trust' }
        },
        set_variable: {
            type: 'set_variable',
            title: I18N.t('designerNodeSetVar'), titleEn: 'Set Variable', titleJa: '変数設定',
            color: '#06b6d4',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' },
                { id: 'in_value', name: I18N.t('designerPinInValue'), nameEn: 'Value', nameJa: '値', type: 'number' }
            ],
            outputs: [
                { id: 'out_exec', name: I18N.t('designerPinOutExec'), nameEn: 'Out', nameJa: '出力', type: 'exec' }
            ],
            data: { variableName: 'trust', operation: 'add', operandValue: 10 } // add/sub/mul/div/set + 操作数值
        },
        end_chapter: {
            type: 'end_chapter',
            title: I18N.t('designerNodeEndChapter'), titleEn: 'End Chapter', titleJa: '章終了',
            color: '#64748b',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' }
            ],
            outputs: [
                { id: 'out_next', name: I18N.t('designerPinOutNext'), nameEn: 'Next', nameJa: '次', type: 'exec' }
            ],
            data: { endingType: 'good', endingTitle: '', endingDesc: '' }
        },
        end_game: {
            type: 'end_game',
            title: I18N.t('designerNodeEndGame'), titleEn: 'Ending', titleJa: 'エンディング',
            color: '#dc2626',
            inputs: [
                { id: 'in_exec', name: I18N.t('designerPinInExec'), nameEn: 'In', nameJa: '入力', type: 'exec' }
            ],
            outputs: [],
            data: { endingType: 'good', endingTitle: '', endingDesc: '', rewardSeeds: 3 }
        },
        character_info: {
            type: 'character_info',
            title: I18N.t('designerNodeCharInfo'), titleEn: 'Character Info', titleJa: 'キャラ情報',
            color: '#a855f7',
            inputs: [],
            outputs: [
                { id: 'out_character', name: I18N.t('designerPinInCharacter'), nameEn: 'Character', nameJa: 'キャラ', type: 'character' }
            ],
            data: { characterId: 'player' }
        }
    };

    // ==================== 节点操作 ====================
    function createNode(type, x, y) {
        const tpl = NODE_TEMPLATES[type];
        if (!tpl) return null;
        const id = genId('node');
        const node = {
            id,
            type: tpl.type,
            x: x || 100 + Math.random() * 100,
            y: y || 100 + Math.random() * 100,
            width: 220,
            data: JSON.parse(JSON.stringify(tpl.data)),
            // key 保留模板中的语义角色(如 out_exec / out_true / out_false)，id 唯一化用于连线
            inputs: tpl.inputs.map(p => ({ ...p, key: p.id, id: genId('pin'), nodeId: id })),
            outputs: tpl.outputs.map(p => ({ ...p, key: p.id, id: genId('pin'), nodeId: id }))
        };
        return node;
    }

    function addNode(type) {
        // 计算画布可视区的中心世界坐标，新节点出现在屏幕中央
        const canvas = document.getElementById('bp-canvas');
        const cw = canvas ? canvas.clientWidth : window.innerWidth;
        const ch = canvas ? canvas.clientHeight : window.innerHeight;
        const x = (cw / 2 - canvasOffset.x) / scale - 110;
        const y = (ch / 2 - canvasOffset.y) / scale - 30;
        const node = createNode(type, x, y);
        if (!node) return;
        currentDesign.nodes.push(node);
        if (!currentDesign.startNode && type === 'event_start') {
            currentDesign.startNode = node.id;
        }
        selectedNodeId = node.id;
        render();
    }

    function deleteNode(nodeId) {
        if (nodeId === currentDesign.startNode) currentDesign.startNode = null;
        currentDesign.nodes = currentDesign.nodes.filter(n => n.id !== nodeId);
        currentDesign.connections = currentDesign.connections.filter(c =>
            c.fromNode !== nodeId && c.toNode !== nodeId
        );
        if (selectedNodeId === nodeId) selectedNodeId = null;
        render();
    }

    function selectNode(nodeId) {
        selectedNodeId = nodeId;
        render();
    }

    // 轻量选择：仅更新选中边框与属性/细节面板，不重建整棵 DOM。
    // 关键：避免拖拽开始时调用 render()（render 会执行 container.innerHTML='' 并重建所有节点），
    // 否则正在拖拽的节点元素被销毁，dragNode.el 变成游离元素，导致节点无法跟随鼠标移动。
    function refreshPropertyPanel() {
        const container = document.getElementById('designer-canvas');
        if (!container) return;
        const old = container.querySelector('.bp-property-panel');
        if (old) old.remove();
        if (selectedNodeId) {
            const panel = createPropertyPanel();
            container.appendChild(panel);
            // 面板是新 DOM 元素，需要绑定 input/change/click 等事件才能保存数据
            // 注意：bindEvents 内部用 querySelectorAll 查找表单元素，旧面板已被 remove，无重复绑定
            bindEvents();
        }
    }

    function selectNodeLight(nodeId) {
        const prev = selectedNodeId;
        selectedNodeId = nodeId;
        if (prev && prev !== nodeId) {
            const prevEl = document.querySelector(`.bp-node[data-node-id="${prev}"]`);
            if (prevEl) prevEl.style.borderColor = 'transparent';
        }
        if (nodeId) {
            const curEl = document.querySelector(`.bp-node[data-node-id="${nodeId}"]`);
            if (curEl) curEl.style.borderColor = '#fff';
        }
        refreshPropertyPanel();
    }

    // ==================== 连接操作 ====================
    function canConnect(fromPin, toPin) {
        if (!fromPin || !toPin) return false;
        if (fromPin.type !== toPin.type) return false;
        if (fromPin.nodeId === toPin.nodeId) return false;
        // exec 类型：每个输出只能连一条（分支）
        if (fromPin.type === 'exec') {
            const existing = currentDesign.connections.find(c => c.fromNode === fromPin.nodeId && c.fromPin === fromPin.id);
            if (existing) return false;
        }
        // 注意：目标输入引脚已有连接的情况不再在此拦截
        // 改由 addConnection 统一处理（支持 force 强制替换）
        return true;
    }

    function addConnection(fromPin, toPin, force) {
        // 基础校验始终执行
        if (!fromPin || !toPin) return false;
        if (fromPin.type !== toPin.type) return false;
        if (fromPin.nodeId === toPin.nodeId) return false;

        // exec 类型输出引脚是否已被使用
        if (fromPin.type === 'exec') {
            const existing = currentDesign.connections.find(c => c.fromNode === fromPin.nodeId && c.fromPin === fromPin.id);
            if (existing && !force) return false;
            if (existing) {
                // force 模式下移除旧的 exec 输出连接
                currentDesign.connections = currentDesign.connections.filter(c => c.id !== existing.id);
            }
        }

        // 目标输入引脚已有连接 → 移除旧连接（force 模式下或选择器模式都允许替换）
        const oldConn = currentDesign.connections.find(c => c.toNode === toPin.nodeId && c.toPin === toPin.id);
        if (oldConn) {
            if (!force) return false; // 非强制模式下不允许覆盖已有连接
            currentDesign.connections = currentDesign.connections.filter(c => c.id !== oldConn.id);
        }

        currentDesign.connections.push({
            id: genId('conn'),
            fromNode: fromPin.nodeId,
            fromPin: fromPin.id,
            toNode: toPin.nodeId,
            toPin: toPin.id
        });
        render();
        return true;
    }

    function deleteConnection(connId) {
        currentDesign.connections = currentDesign.connections.filter(c => c.id !== connId);
        render();
    }

    // ==================== 打开设计器 ====================
    function open(existingDesign) {
        showOverlay();
        if (existingDesign) {
            currentDesign = JSON.parse(JSON.stringify(existingDesign));
            ensureV2Compatibility();
        } else {
            currentDesign = createDefaultDesign();
            const startNode = createNode('event_start', 50, 200);
            const chapterNode = createNode('chapter_begin', 320, 200);
            const dialogueNode = createNode('dialogue', 600, 200);
            const endNode = createNode('end_game', 900, 200);

            currentDesign.nodes.push(startNode, chapterNode, dialogueNode, endNode);
            currentDesign.startNode = startNode.id;

            const sOut = startNode.outputs.find(p => p.type === 'exec');
            const cIn = chapterNode.inputs.find(p => p.type === 'exec');
            const cOut = chapterNode.outputs.find(p => p.type === 'exec');
            const dIn = dialogueNode.inputs.find(p => p.type === 'exec');
            const dOut = dialogueNode.outputs.find(p => p.type === 'exec');
            const eIn = endNode.inputs.find(p => p.type === 'exec');
            currentDesign.connections = [];
            if (sOut && cIn) currentDesign.connections.push({ id: genId('conn'), fromNode: startNode.id, fromPin: sOut.id, toNode: chapterNode.id, toPin: cIn.id });
            if (cOut && dIn) currentDesign.connections.push({ id: genId('conn'), fromNode: chapterNode.id, fromPin: cOut.id, toNode: dialogueNode.id, toPin: dIn.id });
            if (dOut && eIn) currentDesign.connections.push({ id: genId('conn'), fromNode: dialogueNode.id, fromPin: dOut.id, toNode: endNode.id, toPin: eIn.id });
        }
        selectedNodeId = currentDesign.startNode;
        render();
        // 移动端自动适应屏幕，避免节点超出可视区域
        if (isTouch) requestAnimationFrame(fitView);
    }

    function ensureV2Compatibility() {
        if (!currentDesign.version) currentDesign.version = 2;
        if (!currentDesign.variables) currentDesign.variables = {};
        if (!currentDesign.characters) currentDesign.characters = {};
    }

    function showOverlay() {
        const el = document.getElementById('designer-overlay');
        if (el) {
            el.style.display = 'flex';
            el.classList.add('active');
        }
    }

    function close() {
        const el = document.getElementById('designer-overlay');
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
        if (typeof GAME !== 'undefined') GAME.showMainMenu();
    }

    // ==================== 渲染 ====================
    // 当前属性面板中的活跃 textarea 引用，用于防止误删
    let _activeTextarea = null;

    function render() {
        const container = document.getElementById('designer-canvas');
        if (!container) return;

        // 记录当前 textarea 焦点状态
        _activeTextarea = document.activeElement;
        const isEditing = (_activeTextarea && (_activeTextarea.tagName === 'TEXTAREA' || _activeTextarea.tagName === 'INPUT'));

        container.innerHTML = '';

        // 工具栏
        const toolbar = createToolbar();
        container.appendChild(toolbar);

        // 变量面板
        const varPanel = createVariablesPanel();
        container.appendChild(varPanel);

        // 画布
        const canvas = document.createElement('div');
        canvas.className = 'bp-canvas';
        canvas.id = 'bp-canvas';
        // 画布使用 CSS background 作为无限网格（无边缘，拖到哪里网格都在）
        const dotColor = 'rgba(128,128,128,0.35)';
        canvas.style.cssText = `flex:1;position:relative;overflow:hidden;cursor:grab;touch-action:none;overscroll-behavior:none;background-color:var(--bg-primary);background-image:radial-gradient(circle,${dotColor} 1px,transparent 1px);background-repeat:repeat;background-size:${20 * scale}px ${20 * scale}px;background-position:${canvasOffset.x}px ${canvasOffset.y}px;`;

        // SVG 层 — 必须与节点层使用相同的 transform，否则连线坐标与引脚位置错位
        // 使用超大尺寸（200000x200000）的 SVG 元素，使其内部坐标系永远覆盖可视区，
        // 解决引线在边界外被 SVG 视口裁剪的问题
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'bp-svg';
        svg.style.cssText = `position:absolute;top:0;left:0;width:200000px;height:200000px;pointer-events:none;z-index:1;transform:translate(${canvasOffset.x}px,${canvasOffset.y}px) scale(${scale});transform-origin:0 0;overflow:visible;`;
        canvas.appendChild(svg);

        // 节点层
        const nodesLayer = document.createElement('div');
        nodesLayer.id = 'bp-nodes-layer';
        nodesLayer.style.cssText = `position:absolute;top:0;left:0;width:1px;height:1px;transform:translate(${canvasOffset.x}px,${canvasOffset.y}px) scale(${scale});`;
        canvas.appendChild(nodesLayer);

        // 渲染节点
        currentDesign.nodes.forEach(node => {
            const el = createNodeElement(node);
            nodesLayer.appendChild(el);
        });

        // ⚠️ 必须先将 canvas 挂载到 container，否则 getPinPosition 中
        //    document.getElementById('bp-canvas') 返回 null，所有连线无法渲染！
        container.appendChild(canvas);

        // 渲染连接（canvas 已在 DOM 中，getPinPosition 可正常工作）
        const _canvasRect = canvas.getBoundingClientRect();
        renderConnections(svg, _canvasRect);

        // 临时连接
        if (tempConnection) {
            renderTempConnection(svg);
        }

        // 画布事件（移动/释放由全局监听器处理，避免拖出画布后失效）
        canvas.addEventListener('pointerdown', onCanvasPointerDown);
        canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

        // 拖放变量到画布 → 创建 get_variable 节点
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!e.dataTransfer.types.includes('application/blueprint-var')) return;
            canvas.classList.add('bp-canvas-drag-over');
        });
        canvas.addEventListener('dragleave', (e) => {
            // 只在真正离开画布时移除高亮（不触发给子元素）
            if (!canvas.contains(e.relatedTarget)) {
                canvas.classList.remove('bp-canvas-drag-over');
            }
        });
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('bp-canvas-drag-over');
            const varData = e.dataTransfer.getData('application/blueprint-var');
            if (!varData) return;
            try {
                const { key, name, type } = JSON.parse(varData);
                const rect = canvas.getBoundingClientRect();
                // 计算放置位置（世界坐标）
                const dropX = (e.clientX - rect.left - canvasOffset.x) / scale;
                const dropY = (e.clientY - rect.top - canvasOffset.y) / scale;
                // 创建 get_variable 节点
                const node = createNode('get_variable', dropX - 110, dropY - 30); // 居中偏移
                if (node) {
                    node.data.variableName = key;
                    node.data.variableDisplayName = name;
                    currentDesign.nodes.push(node);
                    selectedNodeId = node.id;
                    render();
                }
            } catch(err) {
                console.warn('Failed to create variable ref node:', err);
            }
        });

        // 属性面板
        if (selectedNodeId) {
            const panel = createPropertyPanel();
            container.appendChild(panel);
        }

        bindEvents();

        // 如果之前正在编辑文本，恢复焦点和光标位置
        if (isEditing && _activeTextarea) {
            const savedValue = _activeTextarea.value;
            const savedSelectionStart = _activeTextarea.selectionStart;
            const savedSelectionEnd = _activeTextarea.selectionEnd;
            // 找到新创建的对应元素
            const key = _activeTextarea.dataset.key;
            const selector = _activeTextarea.tagName === 'TEXTAREA'
                ? `.prop-textarea[data-key="${key}"]`
                : `.prop-input[data-key="${key}"]`;
            const newEl = document.querySelector(selector);
            if (newEl) {
                newEl.focus();
                newEl.value = savedValue;
                try { newEl.setSelectionRange(savedSelectionStart, savedSelectionEnd); } catch(e) {}
            }
        }
        _activeTextarea = null;
    }

    function createToolbar() {
        const bar = document.createElement('div');
        bar.className = 'designer-toolbar';
        bar.style.cssText = 'padding:10px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);flex-shrink:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

        const titleInput = document.createElement('input');
        titleInput.id = 'designer-title-input';
        titleInput.value = currentDesign.title || '';
        titleInput.placeholder = I18N.t('designerSceneName');
        titleInput.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:8px 12px;color:var(--text-primary);font-size:0.95rem;flex:1;min-width:140px;max-width:200px;';
        bar.appendChild(titleInput);

        const nodeButtons = [
            ['event_start', '▶', I18N.t('designerNodeEventStart')],
            ['chapter_begin', '▣', I18N.t('designerNodeChapterBegin')],
            ['dialogue', '💬', I18N.t('designerNodeDialogue')],
            ['narration', '✦', I18N.t('designerNodeNarration')],
            ['choice', '⚡', I18N.t('designerNodeChoice')],
            ['condition', '◈', I18N.t('designerNodeCondition')],
            ['set_variable', '◉', I18N.t('designerNodeSetVar')],
            ['end_chapter', '□', I18N.t('designerNodeEndChapter')],
            ['end_game', '■', I18N.t('designerNodeEndGame')]
        ];

        nodeButtons.forEach(([type, icon, label]) => {
            const btn = document.createElement('button');
            btn.className = 'designer-btn';
            btn.innerHTML = `${icon} ${label}`;
            btn.style.cssText = `background:${NODE_TEMPLATES[type].color};color:#fff;border:none;padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;white-space:nowrap;`;
            btn.addEventListener('click', () => addNode(type));
            bar.appendChild(btn);
        });

        const actions = [
            ['btn-designer-save', '💾 ' + I18N.t('designerSave'), 'var(--accent-green)', save],
            ['btn-designer-play', '▶ ' + I18N.t('designerPlay'), 'var(--accent-cyan)', playDesign],
            ['btn-designer-export', '⬇ ' + I18N.t('designerExport'), 'var(--accent-purple)', exportDesign],
            ['btn-designer-import', '⬆ ' + I18N.t('designerImport'), 'var(--accent-blue)', importDesign],
            ['btn-designer-close', '← ' + I18N.t('mainMenu'), 'transparent', close]
        ];

        actions.forEach(([id, label, color, handler]) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.className = 'designer-btn';
            btn.innerHTML = label;
            btn.style.cssText = `background:${color === 'transparent' ? 'transparent' : color};color:${color === 'transparent' ? 'var(--text-secondary)' : '#fff'};border:1px solid ${color === 'transparent' ? 'var(--border-color)' : color};padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;`;
            btn.addEventListener('click', handler);
            bar.appendChild(btn);
        });

        // 移动端专用按钮（仅在窄屏显示，见 CSS）
        const mobileBtns = [
            ['btn-toggle-vars', '☰ ' + I18N.t('designerVarSection'), () => {
                const vp = document.getElementById('bp-variables-panel') || document.querySelector('.bp-variables-panel');
                if (vp) vp.classList.toggle('open');
            }],
            ['btn-fit-view', '⊡ ' + I18N.t('designerFitView'), () => fitView()]
        ];
        mobileBtns.forEach(([id, label, handler]) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.className = 'designer-btn mobile-only-btn';
            btn.innerHTML = label;
            btn.style.cssText = 'background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-color);padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;';
            btn.addEventListener('click', handler);
            bar.appendChild(btn);
        });

        const info = document.createElement('div');
        info.style.cssText = 'font-size:0.75rem;color:var(--text-muted);width:100%;';
        info.innerHTML = `💠 ${I18N.t('seedBalance')}: ${SAVE.getSeeds()} | ${I18N.t('designerNode')}: ${currentDesign.nodes.length} | ${I18N.t('designerChoice')}: ${currentDesign.connections.length} | ${I18N.t('designerHintDrag')}`;
        bar.appendChild(info);

        return bar;
    }

    function createVariablesPanel() {
        const panel = document.createElement('div');
        panel.className = 'bp-variables-panel';
        panel.id = 'bp-variables-panel';
        panel.style.cssText = 'position:absolute;left:0;top:72px;bottom:0;width:200px;background:var(--bg-secondary);border-right:1px solid var(--border-color);padding:12px;z-index:10;overflow-y:auto;';
        panel.innerHTML = `<div style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">📊 ${I18N.t('designerScene')}</div>`;

        // ── 变量区域 ──
        const varSection = document.createElement('div');
        varSection.id = 'bp-var-section';
        varSection.innerHTML = `<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
            <span>${I18N.t('designerVarSection')}</span>
            <button id="bp-add-var-btn" style="background:none;border:1px dashed var(--accent-blue);color:var(--accent-blue);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:0.7rem;">${I18N.t('designerAddVar')}</button>
        </div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;font-style:italic;">${I18N.t('designerDragVarToCanvas')}</div>`;

        Object.entries(currentDesign.variables || {}).forEach(([key, v]) => {
            const item = document.createElement('div');
            item.className = 'bp-var-item';
            item.dataset.varKey = key;
            item.draggable = true;
            const hudOn = v.showOnHud !== false; // 默认开启
            item.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 8px;margin-bottom:6px;font-size:0.75rem;position:relative;cursor:grab;';
            const typeColor = TYPE_COLORS[v.type] || '#9ca3af';
            const hudColor = hudOn ? 'var(--accent-cyan)' : 'var(--text-muted)';
            item.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="flex:1;min-width:0;">
                        <div class="bp-var-name" style="color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(v.name)}</div>
                        <div style="color:var(--text-muted);font-size:0.68rem;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${typeColor};vertical-align:middle;margin-right:3px;"></span>${v.type} = <strong>${v.defaultValue}</strong></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                        <button class="bp-hud-toggle-btn" data-key="${key}" data-on="${hudOn}" style="background:none;border:none;color:${hudColor};cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;opacity:0.7;" title="${I18N.t('designerHudToggle') || '游玩时显示在界面中'}">👁</button>
                        <button class="bp-rename-var-btn" data-key="${key}" style="background:none;border:none;color:var(--accent-blue);cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;" title="重命名变量">✏</button>
                        <button class="bp-del-var-btn" data-key="${key}" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;" title="删除变量">✕</button>
                    </div>
                </div>`;
            // 拖拽开始：将变量信息存入 dataTransfer
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/blueprint-var', JSON.stringify({ key, name: v.name, type: v.type }));
                e.dataTransfer.effectAllowed = 'copy';
                item.style.opacity = '0.5';
                item.style.cursor = 'grabbing';
            });
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                item.style.cursor = 'grab';
                // 清除画布高亮
                const canvas = document.getElementById('bp-canvas');
                if (canvas) canvas.classList.remove('bp-canvas-drag-over');
            });
            // 触摸端不支持 HTML5 拖放：点击变量直接生成 get_variable 节点到视图中心
            if (isTouch) {
                item.addEventListener('click', () => addVariableNodeAtCenter(key));
            }
            varSection.appendChild(item);
        });
        panel.appendChild(varSection);

        // ── 角色区域 ──
        const charSection = document.createElement('div');
        charSection.id = 'bp-char-section';
        charSection.innerHTML = `<div style="font-size:0.75rem;color:var(--text-secondary);margin:14px 0 6px;">${I18N.t('designerCharSection')}</div>`;
        Object.entries(currentDesign.characters || {}).forEach(([key, c]) => {
            const item = document.createElement('div');
            item.className = 'bp-char-item';
            item.dataset.charKey = key;
            item.style.cssText = 'display:flex;align-items:center;gap:6px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 8px;margin-bottom:6px;font-size:0.75rem;position:relative;';
            // 旁白和玩家不允许删（基础角色）
            const isSystem = (key === 'narrator' || key === 'player');
            item.innerHTML = `
                <span class="bp-char-icon-btn" data-key="${key}" style="font-size:1rem;cursor:pointer;padding:2px 4px;border-radius:4px;border:1px solid transparent;" title="${I18N.t('designerPickIcon')}">${c.icon}</span>
                <span class="bp-char-name" style="color:${c.color};flex:1;">${escapeHtml(c.name)}</span>
                <button class="bp-rename-char-btn" data-key="${key}" style="background:none;border:none;color:var(--accent-blue);cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;" title="重命名角色">✏</button>
                ${!isSystem ? `<button class="bp-del-char-btn" data-key="${key}" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:0.85rem;padding:2px 4px;line-height:1;" title="删除角色">✕</button>` : ''}`;
            charSection.appendChild(item);
        });
        panel.appendChild(charSection);

        const addBtn = document.createElement('button');
        addBtn.id = 'bp-add-char-btn';
        addBtn.innerHTML = I18N.t('designerAddChar');
        addBtn.style.cssText = 'width:100%;background:transparent;border:1px dashed var(--accent-purple);color:var(--accent-purple);padding:6px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;margin-top:8px;';
        addBtn.addEventListener('click', addCharacter);
        panel.appendChild(addBtn);

        // 延迟绑定事件（等 DOM 插入后）
        requestAnimationFrame(() => bindVarCharEvents());

        return panel;
    }

    // ==================== 变量/角色 CRUD ====================
    function bindVarCharEvents() {
        // 删除变量
        document.querySelectorAll('.bp-del-var-btn').forEach(btn => {
            btn.onclick = () => deleteVariable(btn.dataset.key);
        });
        // HUD 显示开关
        document.querySelectorAll('.bp-hud-toggle-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const key = btn.dataset.key;
                const v = currentDesign.variables[key];
                if (!v) return;
                const newState = btn.dataset.on === 'true' ? false : true;
                v.showOnHud = newState;
                btn.dataset.on = String(newState);
                btn.style.color = newState ? 'var(--accent-cyan)' : 'var(--text-muted)';
                btn.style.opacity = newState ? '0.7' : '0.35';
                btn.title = newState ? (I18N.t('designerHudOn') || '游玩时显示 ✓') : (I18N.t('designerHudOff') || '游玩时不显示');
            };
        });
        // 添加变量
        document.getElementById('bp-add-var-btn')?.addEventListener('click', showAddVariableDialog);
        // 重命名变量
        document.querySelectorAll('.bp-rename-var-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                inlineEditVariableName(btn.dataset.key);
            };
        });
        // 删除角色
        document.querySelectorAll('.bp-del-char-btn').forEach(btn => {
            btn.onclick = () => deleteCharacter(btn.dataset.key);
        });
        // 重命名角色
        document.querySelectorAll('.bp-rename-char-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                inlineEditCharacterName(btn.dataset.key);
            };
        });
        // 点击角色图标 → Emoji 选择器
        document.querySelectorAll('.bp-char-icon-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                showIconPicker(btn.dataset.key, btn);
            };
        });
    }

    // ==================== 变量/角色 重命名（内联编辑）====================
    function inlineEditVariableName(key) {
        const item = document.querySelector(`.bp-var-item[data-var-key="${key}"]`);
        if (!item) return;
        const nameEl = item.querySelector('.bp-var-name');
        if (!nameEl) return;
        const v = currentDesign.variables[key];
        if (!v) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = v.name;
        input.style.cssText = 'width:100%;background:var(--bg-primary);border:1px solid var(--accent-blue);border-radius:4px;padding:2px 4px;color:var(--text-primary);font-size:0.75rem;font-weight:600;box-sizing:border-box;';

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        const finishEdit = (save) => {
            if (save) {
                const val = input.value.trim();
                if (val) v.name = val;
            }
            const newNameEl = document.createElement('div');
            newNameEl.className = 'bp-var-name';
            newNameEl.style.cssText = 'color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            newNameEl.textContent = v.name;
            input.replaceWith(newNameEl);
        };

        input.addEventListener('blur', () => finishEdit(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEdit(true);
            else if (e.key === 'Escape') finishEdit(false);
        });
    }

    function inlineEditCharacterName(key) {
        const item = document.querySelector(`.bp-char-item[data-char-key="${key}"]`);
        if (!item) return;
        const nameEl = item.querySelector('.bp-char-name');
        if (!nameEl) return;
        const c = currentDesign.characters[key];
        if (!c) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = c.name;
        input.style.cssText = 'width:100%;background:var(--bg-primary);border:1px solid var(--accent-purple);border-radius:4px;padding:2px 4px;color:var(--text-primary);font-size:0.75rem;box-sizing:border-box;';

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        const finishEdit = (save) => {
            if (save) {
                const val = input.value.trim();
                if (val) c.name = val;
            }
            const newNameEl = document.createElement('span');
            newNameEl.className = 'bp-char-name';
            newNameEl.style.cssText = `color:${c.color};flex:1;`;
            newNameEl.textContent = c.name;
            input.replaceWith(newNameEl);
        };

        input.addEventListener('blur', () => finishEdit(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEdit(true);
            else if (e.key === 'Escape') finishEdit(false);
        });
    }

    function showAddVariableDialog() {
        // 创建一个内嵌的添加行，避免用 prompt
        const section = document.getElementById('bp-var-section');
        if (!section) return;
        // 如果已经显示了输入行就不重复创建
        if (document.getElementById('bp-new-var-row')) return;

        const row = document.createElement('div');
        row.id = 'bp-new-var-row';
        row.style.cssText = 'background:var(--bg-card);border:1px dashed var(--accent-blue);border-radius:var(--radius-sm);padding:8px;margin-bottom:6px;font-size:0.75rem;';
        row.innerHTML = `
            <input id="bp-new-var-name" placeholder="${I18N.t('designerVarNamePlaceholder')}" style="width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;padding:4px 6px;color:var(--text-primary);font-size:0.75rem;margin-bottom:4px;box-sizing:border-box;">
            <div style="display:flex;gap:4px;margin-bottom:4px;">
                <select id="bp-new-var-type" style="flex:1;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;padding:4px 6px;color:var(--text-primary);font-size:0.75rem;">
                    <option value="number">${I18N.t('designerTypeInt')}</option>
                    <option value="float">${I18N.t('designerTypeFloat')}</option>
                    <option value="boolean">${I18N.t('designerTypeBool')}</option>
                    <option value="string">${I18N.t('designerTypeString')}</option>
                </select>
            </div>
            <input id="bp-new-var-default" placeholder="${I18N.t('designerDefaultVal')}" style="width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;padding:4px 6px;color:var(--text-primary);font-size:0.75rem;margin-bottom:4px;box-sizing:border-box;">
            <div style="display:flex;gap:4px;">
                <button id="bp-confirm-var-btn" style="flex:1;background:var(--accent-blue);color:#fff;border:none;border-radius:4px;padding:4px;cursor:pointer;font-size:0.75rem;">${I18N.t('designerConfirm')}</button>
                <button id="bp-cancel-var-btn" style="flex:1;background:transparent;border:1px solid var(--border-color);color:var(--text-secondary);border-radius:4px;padding:4px;cursor:pointer;font-size:0.75rem;">${I18N.t('designerCancel')}</button>
            </div>`;

        section.appendChild(row);

        // 聚焦名称输入框
        document.getElementById('bp-new-var-name').focus();

        document.getElementById('bp-confirm-var-btn').onclick = () => confirmAddVariable();
        document.getElementById('bp-cancel-var-btn').onclick = () => row.remove();
        document.getElementById('bp-new-var-name').onkeydown = (e) => { if (e.key === 'Enter') confirmAddVariable(); };
    }

    function confirmAddVariable() {
        const nameEl = document.getElementById('bp-new-var-name');
        const typeEl = document.getElementById('bp-new-var-type');
        const defaultEl = document.getElementById('bp-new-var-default');
        if (!nameEl || !typeEl || !defaultEl) return;

        const name = nameEl.value.trim();
        if (!name) { alert(I18N.t('designerVarNameRequired')); return; }
        const type = typeEl.value;
        let defaultValue;
        try {
            defaultValue = parseDefaultValue(defaultEl.value.trim(), type);
        } catch (err) {
            alert(err.message);
            return;
        }

        const key = 'var_' + name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        currentDesign.variables[key] = {
            name,
            nameEn: name,
            nameJa: name,
            type,
            defaultValue
        };

        render(); // 重绘面板以显示新变量
    }

    function parseDefaultValue(raw, type) {
        if (raw === '') {
            switch (type) {
                case 'number': return 0;
                case 'float': return 0.0;
                case 'boolean': return false;
                case 'string': return '';
            }
        }
        switch (type) {
            case 'number': {
                const n = parseInt(raw, 10);
                if (isNaN(n)) throw new Error('整数格式不正确');
                return n;
            }
            case 'float': {
                const f = parseFloat(raw);
                if (isNaN(f)) throw new Error('浮点数格式不正确');
                return f;
            }
            case 'boolean':
                return raw === 'true' || raw === '1' || raw === '是' ? true : false;
            case 'string':
                return raw;
            default:
                return raw;
        }
    }

    function deleteVariable(key) {
        const v = currentDesign.variables[key];
        if (!v) return;
        if (!confirm(I18N.t('designerConfirmDelVar', { name: v.name }) + '\n\n' + I18N.t('designerConfirmDelVar', { name: v.name }).replace(/[^\n]*/, ''))) return;
        delete currentDesign.variables[key];
        render();
    }

    function deleteCharacter(key) {
        const c = currentDesign.characters[key];
        if (!c) return;
        if (!confirm(I18N.t('designerConfirmDelChar', { name: c.name }))) return;
        delete currentDesign.characters[key];
        render();
    }

    function createNodeElement(node) {
        const tpl = NODE_TEMPLATES[node.type];
        const isSelected = node.id === selectedNodeId;
        const isStart = node.id === currentDesign.startNode;

        const el = document.createElement('div');
        el.className = 'bp-node';
        el.dataset.nodeId = node.id;
        el.style.cssText = `
            position:absolute;left:0;top:0;transform:translate(${node.x}px, ${node.y}px);width:220px;
            background:var(--bg-card);border-radius:var(--radius-md);
            border:2px solid ${isSelected ? '#fff' : 'transparent'};
            box-shadow:0 4px 16px rgba(0,0,0,0.4);
            overflow:hidden;z-index:5;cursor:pointer;will-change:transform;touch-action:none;
        `;

        // 标题栏
        const header = document.createElement('div');
        header.style.cssText = `background:${tpl.color};padding:8px 12px;display:flex;align-items:center;justify-content:space-between;`;
        header.innerHTML = `<span style="font-weight:700;font-size:0.9rem;color:#fff;">${getText(tpl.title, tpl.titleEn, tpl.titleJa)}</span>`;
        if (isStart) header.innerHTML += `<span style="font-size:0.6rem;background:rgba(255,255,255,0.2);color:#fff;padding:1px 6px;border-radius:8px;">${I18N.t('designerHintStart')}</span>`;

        // 添加删除按钮（起始节点不允许删除）
        if (!isStart) {
            const delBtn = document.createElement('button');
            delBtn.className = 'bp-node-delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = I18N.t('designerDelete') || '删除节点';
            delBtn.style.cssText = 'background:rgba(239,68,68,0.8);border:none;color:#fff;border-radius:4px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.7rem;padding:0;margin-left:6px;transition:background 0.15s;';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm((I18N.t('designerConfirmDelNode') || '确定要删除此节点吗？') + `\n(${getText(tpl.title, tpl.titleEn, tpl.titleJa)})`)) {
                    deleteNode(node.id);
                }
            });
            delBtn.addEventListener('mouseenter', () => { delBtn.style.background = '#ef4444'; });
            delBtn.addEventListener('mouseleave', () => { delBtn.style.background = 'rgba(239,68,68,0.8)'; });
            header.appendChild(delBtn);
        }

        el.appendChild(header);

        // 输入引脚
        const inputsDiv = document.createElement('div');
        inputsDiv.className = 'bp-pins inputs';
        inputsDiv.style.cssText = 'position:relative;padding:6px 0 0 0;';
        node.inputs.forEach(pin => {
            inputsDiv.appendChild(createPin(pin, 'input'));
        });
        el.appendChild(inputsDiv);

        // 内容区域
        const body = document.createElement('div');
        body.className = 'bp-node-body';
        body.style.cssText = 'padding:8px 12px;min-height:40px;font-size:0.8rem;color:var(--text-secondary);touch-action:none;';
        body.innerHTML = getNodeBodyPreview(node);
        // 移动端：点击节点 body 区域直接打开细节面板（不触发拖拽）
        // 使用 click 事件确保在所有触控设备上可靠触发
        body.addEventListener('click', (e) => {
            e.stopPropagation();
            // 选中并打开面板（不启动拖拽）
            if (dragNode) { dragNode = null; }
            selectNodeLight(node.id);
        });
        el.appendChild(body);

        // 输出引脚
        const outputsDiv = document.createElement('div');
        outputsDiv.className = 'bp-pins outputs';
        outputsDiv.style.cssText = 'position:relative;padding:0 0 6px 0;';
        node.outputs.forEach(pin => {
            outputsDiv.appendChild(createPin(pin, 'output'));
        });
        el.appendChild(outputsDiv);

        // 节点拖拽（使用指针事件，兼容鼠标/触摸/触控笔；排除引脚和删除按钮区域）
        // 绑定在整个节点上，扩大可拖拽区域，移动端更易操作
        el.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.bp-pin')) return;
            if (e.target.closest('.bp-node-delete-btn')) return; // 删除按钮不触发拖拽
            if (e.button === 2) return; // 右键不拖拽
            // 移动端：点击 body 区域不启动拖拽（由 body.click 单独处理面板打开），
            // 只有拖拽操作（pointermove > 阈值）才设为拖拽模式。
            if (e.pointerType === 'touch' && e.target.closest('.bp-node-body')) {
                selectNodeLight(node.id);
                e.preventDefault();
                return;
            }
            dragNode = { id: node.id, el, startX: e.clientX, startY: e.clientY, nodeX: node.x, nodeY: node.y };
            // 轻量选中：不重建 DOM，保证 dragNode.el 始终有效，节点实时跟随鼠标
            selectNodeLight(node.id);
            e.preventDefault(); // 防止触摸时误选中文本/页面滚动
        });

        return el;
    }

    function createPin(pin, direction) {
        const el = document.createElement('div');
        el.className = 'bp-pin';
        el.dataset.pinId = pin.id;
        el.dataset.nodeId = pin.nodeId;
        el.dataset.direction = direction;
        el.dataset.type = pin.type;
        el.style.cssText = `
            position:relative;display:flex;align-items:center;gap:6px;
            padding:2px 8px;margin:1px 0;font-size:0.7rem;cursor:crosshair;touch-action:none;
            ${direction === 'output' ? 'justify-content:flex-end;' : ''}
        `;
        el.innerHTML = `
            <span class="bp-pin-circle" style="width:10px;height:10px;border-radius:50%;background:${TYPE_COLORS[pin.type] || '#999'};border:2px solid var(--bg-card);box-shadow:0 0 0 1px ${TYPE_COLORS[pin.type] || '#999'};z-index:6;"></span>
            <span style="color:var(--text-secondary);white-space:nowrap;${direction === 'output' ? 'order:-1;' : ''}">${getText(pin.name, pin.nameEn, pin.nameJa)}</span>
        `;

        // 从任意引脚按下即可开始连线（输出或输入方向均可）
        // 若已有活跃的连接（tempConnection），则直接完成连线（点击引脚 → 点击引脚，无需拖拽）
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (tempConnection && _finishConnectionFromTemp(pin, direction)) return;
            beginConnection(pin, direction);
        });

        // 部分 Android WebView/HBuilder WebView 中 Pointer Events 支持不完整，
        // 加上 touchstart 作为兜底。CSS touch-action:none 已禁止浏览器默认滚动，
        // 这里用被动模式（不必 preventDefault）。
        el.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (tempConnection && _finishConnectionFromTemp(pin, direction)) return;
            beginConnection(pin, direction);
        }, { passive: true });

        el.addEventListener('mouseenter', () => {
            const c = el.querySelector('.bp-pin-circle');
            if (c) c.style.transform = 'scale(1.4)';
            // 连线过程中高亮可对接的引脚
            if (tempConnection && isCompatibleTarget(pin, direction)) {
                el.style.background = 'rgba(255,255,255,0.12)';
            }
        });
        el.addEventListener('mouseleave', () => {
            const c = el.querySelector('.bp-pin-circle');
            if (c) c.style.transform = 'scale(1)';
            el.style.background = '';
        });

        return el;
    }

    function getNodeBodyPreview(node) {
        const tpl = NODE_TEMPLATES[node.type];
        if (node.type === 'dialogue' || node.type === 'narration') {
            return `<div style="color:var(--text-primary);">${escapeHtml(node.data.text || '...').substring(0, 60)}</div>`;
        }
        if (node.type === 'choice') {
            return node.data.choices.map((c, i) => `<div style="color:var(--accent-yellow);font-size:0.7rem;">${i+1}. ${escapeHtml(c.text || '').substring(0, 20)}</div>`).join('');
        }
        if (node.type === 'condition') {
            const d = node.data;
            const leftLabel = d.leftType === 'direct' ? d.leftDirect : (d.leftVariable || '?');
            const rightLabel = d.compareWith === 'direct' ? d.rightDirect : (d.compareWith === 'variable' ? (d.rightVariable || '?') : '📌引针');
            return `<div style="color:var(--accent-pink);font-size:0.75rem;font-weight:600;">${escapeHtml(String(leftLabel))} ${d.operator || '>='} ${escapeHtml(String(rightLabel))}</div>`;
        }
        if (node.type === 'set_variable') {
            const v = (currentDesign.variables || {})[node.data.variableName] || {};
            const op = node.data.operation || 'add';
            const val = node.data.operandValue ?? 10;
            const opLabels = { set: '=', add: '+', sub: '-', mul: '×', div: '÷' };
            const opText = I18N.t('designerOp' + op.charAt(0).toUpperCase() + op.slice(1)) || op;
            return `<div style="color:var(--accent-cyan);font-size:0.75rem;font-weight:600;">${escapeHtml(v.name || node.data.variableName)} <span style="color:var(--accent-yellow);">${opLabels[op] || op}</span> ${val}</div>`;
        }
        if (node.type === 'get_variable') {
            const v = (currentDesign.variables || {})[node.data.variableName] || {};
            return `<div style="color:var(--accent-blue);font-size:0.75rem;">${I18N.t('designerGetVarPrefix')} ${escapeHtml(v.name || node.data.variableName)}</div>`;
        }
        if (node.type === 'chapter_begin') {
            return `<div style="color:var(--text-primary);font-size:0.8rem;">${escapeHtml(node.data.chapterTitle || '新章节').substring(0, 30)}</div>`;
        }
        if (node.type === 'end_game') {
            return `<div style="color:var(--accent-red);font-size:0.75rem;">${escapeHtml(node.data.endingType || 'good').toUpperCase()}</div>`;
        }
        return '';
    }

    // ==================== 连接渲染 ====================
    function renderConnections(svg, canvasRect) {
        currentDesign.connections.forEach(conn => {
            const fromPos = getPinPosition(conn.fromNode, conn.fromPin, canvasRect);
            const toPos = getPinPosition(conn.toNode, conn.toPin, canvasRect);
            if (!fromPos || !toPos) return;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = createBezierPath(fromPos, toPos);
            const pin = getPinById(conn.fromPin);
            const color = TYPE_COLORS[pin?.type || 'exec'];
            path.setAttribute('d', d);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', pin?.type === 'exec' ? '2' : '1.5');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('class', 'bp-connection');
            path.dataset.connId = conn.id;
            path.style.cursor = 'pointer';
            path.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.shiftKey || e.ctrlKey) deleteConnection(conn.id);
            });
            svg.appendChild(path);
        });
    }

    function renderTempConnection(svg) {
        if (!tempConnection) return;
        const startPos = tempConnection.startPos;
        const endPos = tempConnection.currentPos;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = createBezierPath(startPos, endPos);
        const color = TYPE_COLORS[tempConnection.pin.type || 'exec'];
        path.setAttribute('d', d);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '5,3');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
    }

    function createBezierPath(from, to) {
        const midX = (from.x + to.x) / 2;
        return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
    }

    // 返回引脚圆心的"世界坐标"（与 SVG 内部坐标系一致：不受 scale/translate 影响）。
    // 原理：节点层有 transform: translate(X, Y) scale(S)，引脚的屏幕坐标 = 世界坐标 * S + offset。
    // 反推：世界坐标 = (屏幕坐标 - offset) / S
    function getPinPosition(nodeId, pinId, canvasRect) {
        const canvas = document.getElementById('bp-canvas');
        if (!canvas) return null;
        const cr = canvasRect || canvas.getBoundingClientRect();
        const nodeEl = document.querySelector(`.bp-node[data-node-id="${nodeId}"]`);
        if (!nodeEl) return null;
        const pinEl = nodeEl.querySelector(`.bp-pin[data-pin-id="${pinId}"] .bp-pin-circle`);
        if (!pinEl) return null;
        const pinRect = pinEl.getBoundingClientRect();
        // 引脚圆心在画布内的像素坐标
        const screenX = pinRect.left - cr.left + pinRect.width / 2;
        const screenY = pinRect.top - cr.top + pinRect.height / 2;
        // 反算回世界坐标（SVG 内部使用同一坐标系）
        return {
            x: (screenX - canvasOffset.x) / scale,
            y: (screenY - canvasOffset.y) / scale
        };
    }

    function getPinById(pinId) {
        for (const node of currentDesign.nodes) {
            const pin = [...node.inputs, ...node.outputs].find(p => p.id === pinId);
            if (pin) return pin;
        }
        return null;
    }

    function getPinByIdFull(pinId) {
        for (const node of currentDesign.nodes) {
            const pin = [...node.inputs, ...node.outputs].find(p => p.id === pinId);
            if (pin) return { ...pin, node };
        }
        return null;
    }

    function updateNodePreview(node) {
        const el = document.querySelector(`.bp-node[data-node-id="${node.id}"]`);
        if (el) {
            const body = el.querySelector('.bp-node-body');
            if (body) body.innerHTML = getNodeBodyPreview(node);
        }
    }

    // ==================== 连接拖拽 ====================
    // 从任意引脚开始拖拽（记录起点引脚与方向）
    function beginConnection(pin, direction) {
        const pos = getPinPosition(pin.nodeId, pin.id);
        if (!pos) return;
        tempConnection = {
            pin,
            direction,
            startPos: pos,
            currentPos: { x: pos.x, y: pos.y }
        };
        updateSvgLines();
    }

    // 已有一个活跃连接（tempConnection）时，点击目标引脚直接完成连线。
    // 手机端用户无需拖拽，点输出引脚 → 点输入引脚 即可建立连线。
    function _finishConnectionFromTemp(targetPin, targetDirection) {
        if (!tempConnection) return false;
        const fromPin = tempConnection.pin;
        const fromDir = tempConnection.direction;
        // 排除连接到同一个引脚
        if (targetPin.id === fromPin.id && targetPin.nodeId === fromPin.nodeId) return false;
        let outPin, inPin;
        if (fromDir === 'output' && targetDirection === 'input') {
            outPin = fromPin; inPin = targetPin;
        } else if (fromDir === 'input' && targetDirection === 'output') {
            outPin = targetPin; inPin = fromPin;
        } else {
            return false; // 同方向不能连接
        }
        if (!canConnect(outPin, inPin)) return false;
        addConnection(outPin, inPin);
        tempConnection = null;
        forceUpdateConnections();
        return true;
    }

    // 判断目标引脚是否可以与当前拖拽中的引脚对接（方向相反 + canConnect）
    function isCompatibleTarget(targetPin, targetDirection) {
        if (!tempConnection) return false;
        const fromDir = tempConnection.direction;
        if (fromDir === targetDirection) return false;
        let outPin, inPin;
        if (fromDir === 'output') { outPin = tempConnection.pin; inPin = targetPin; }
        else { outPin = targetPin; inPin = tempConnection.pin; }
        return canConnect(outPin, inPin);
    }

    // 在鼠标释放位置寻找目标引脚并建立连接（使用 elementFromPoint，稳定可靠）
    function finishConnectionAt(clientX, clientY) {
        if (!tempConnection) return;
        const pinEl = _findPinAt(clientX, clientY);
        if (!pinEl) return;
        const toNodeId = pinEl.dataset.nodeId;
        const toPinId = pinEl.dataset.pinId;
        const toDirection = pinEl.dataset.direction;
        const toPin = getPinByNodeIdAndId(toNodeId, toPinId);
        if (!toPin) return;

        const fromPin = tempConnection.pin;
        const fromDirection = tempConnection.direction;

        // 归一化为 输出->输入 的方向
        let outPin, inPin;
        if (fromDirection === 'output' && toDirection === 'input') {
            outPin = fromPin; inPin = toPin;
        } else if (fromDirection === 'input' && toDirection === 'output') {
            outPin = toPin; inPin = fromPin;
        } else {
            return; // 同方向不能连接
        }
        addConnection(outPin, inPin);
    }

    // ==================== 画布交互（Pointer Events，兼容鼠标/触摸/触控笔）====================
    function _dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function _mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

    // 在坐标 (x, y) 处查找最近的 .bp-pin 元素。
    // 移动端 document.elementFromPoint 在触摸事件处理期间会"隐藏"被触摸元素导致返回 null，
    // 因此优先使用 elementsFromPoint（返回该坐标下所有层级的元素数组，不受触摸状态影响）兜底。
    function _findPinAt(x, y) {
        // 先用 elementFromPoint（桌面端快路径）
        let el = document.elementFromPoint(x, y);
        if (el) {
            const pin = el.closest('.bp-pin');
            if (pin) return pin;
        }
        // 移动端兜底：elementsFromPoint 不隐藏被触摸的元素
        if (typeof document.elementsFromPoint === 'function') {
            const els = document.elementsFromPoint(x, y);
            for (let i = 0; i < els.length; i++) {
                const pin = els[i].closest('.bp-pin');
                if (pin) return pin;
            }
        }
        return null;
    }

    function onCanvasPointerDown(e) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // 双指 → 进入缩放模式
        if (activePointers.size === 2) {
            const pts = [...activePointers.values()];
            pinchStartDist = _dist(pts[0], pts[1]);
            pinchStartScale = scale;
            pinchMidScreen = _mid(pts[0], pts[1]);
            const canvas = document.getElementById('bp-canvas');
            const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            pinchAnchorWorld = {
                x: (pinchMidScreen.x - rect.left - canvasOffset.x) / scale,
                y: (pinchMidScreen.y - rect.top - canvasOffset.y) / scale
            };
            pinching = true;
            panning = false;
            dragNode = null;
            tempConnection = null;
            return;
        }

        // 仅当点击在空白处（画布/网格/SVG/节点层）才处理平移/取消选中
        const onEmpty = (e.target === e.currentTarget || e.target.classList.contains('bp-canvas') ||
            e.target.id === 'bp-svg' || e.target.id === 'bp-nodes-layer');
        if (!onEmpty) return;

        if (e.pointerType === 'touch') {
            // 触摸：单指拖拽空白处即平移画布（移动端核心交互）
            panning = true;
            panStart = { x: e.clientX, y: e.clientY };
            const canvas = document.getElementById('bp-canvas');
            if (canvas) canvas.style.cursor = 'grabbing';
            e.preventDefault();
        } else {
            // 鼠标：中键/右键平移；左键空白处取消选中
            if (e.button === 1 || e.button === 2) {
                panning = true;
                panStart = { x: e.clientX, y: e.clientY };
                const canvas = document.getElementById('bp-canvas');
                if (canvas) canvas.style.cursor = 'grabbing';
                e.preventDefault();
            } else if (e.button === 0) {
                selectedNodeId = null;
                render();
            }
        }
    }

    // 仅在设计器激活时处理全局鼠标事件
    function designerActive() {
        const overlay = document.getElementById('designer-overlay');
        return overlay && overlay.classList.contains('active');
    }

    function onGlobalMouseMove(e) {
        if (!designerActive()) return;

        // 记录指针位置（用于双指缩放）
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        // 双指缩放：以起始中点为锚点，保持该点下的世界坐标不动
        if (pinching && activePointers.size >= 2) {
            const pts = [...activePointers.values()];
            const d = _dist(pts[0], pts[1]);
            const canvas = document.getElementById('bp-canvas');
            const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            const newScale = Math.max(0.3, Math.min(2.5, pinchStartScale * (d / (pinchStartDist || 1))));
            scale = newScale;
            canvasOffset.x = (pinchMidScreen.x - rect.left) - pinchAnchorWorld.x * newScale;
            canvasOffset.y = (pinchMidScreen.y - rect.top) - pinchAnchorWorld.y * newScale;
            applyCanvasTransform();
            forceUpdateConnections(); // 缩放需要立即更新
            return;
        }

        if (panning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            canvasOffset.x += dx / scale;
            canvasOffset.y += dy / scale;
            panStart = { x: e.clientX, y: e.clientY };
            applyCanvasTransform();
            scheduleConnectionUpdate(); // rAF 节流
            return;
        }

        if (dragNode) {
            const dx = (e.clientX - dragNode.startX) / scale;
            const dy = (e.clientY - dragNode.startY) / scale;
            const node = currentDesign.nodes.find(n => n.id === dragNode.id);
            if (node) {
                node.x = dragNode.nodeX + dx;
                node.y = dragNode.nodeY + dy;
                // 始终作用于当前真实存在的节点元素（防御性：即便 DOM 被重建也能正确跟随）
                const liveEl = document.querySelector(`.bp-node[data-node-id="${dragNode.id}"]`) || dragNode.el;
                // 使用 transform 替代 left/top — 避免触发 reflow，只触发 composite
                liveEl.style.transform = `translate(${node.x}px, ${node.y}px)`;
                scheduleConnectionUpdate(); // rAF 节流，不立即更新 SVG
            }
            return;
        }

        if (tempConnection) {
            const canvas = document.getElementById('bp-canvas');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            // 指针在画布内的像素坐标 → 转世界坐标（与 SVG 坐标系一致）
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            tempConnection.currentPos = {
                x: (screenX - canvasOffset.x) / scale,
                y: (screenY - canvasOffset.y) / scale
            };
            scheduleConnectionUpdate(); // rAF 节流
        }
    }

    function onGlobalMouseUp(e) {
        activePointers.delete(e.pointerId);

        // 双指缩放结束
        if (pinching && activePointers.size < 2) {
            pinching = false;
            // 若仍有一指按在画布上，继续以平移方式处理
            if (activePointers.size === 1) {
                const p = [...activePointers.values()][0];
                panStart = { x: p.x, y: p.y };
                panning = true;
            }
            return;
        }

        if (!designerActive()) return;

        if (panning) {
            panning = false;
            const canvas = document.getElementById('bp-canvas');
            if (canvas) canvas.style.cursor = 'grab';
        }

        if (dragNode) {
            // 拖动结束：立即做一次完整连线更新确保最终状态正确
            forceUpdateConnections();
            dragNode = null;
        }

        if (tempConnection) {
            // 先尝试正常连接
            const fromPin = tempConnection.pin;
            const fromDir = tempConnection.direction;

            // 检查是否命中了目标引脚（移动端用 elementsFromPoint 兜底）
            const pinEl = _findPinAt(e.clientX, e.clientY);
            let connected = false;

            // 松手位置在同一引脚上 → 不完成连线、不弹选择器，
            // 保持 tempConnection 等待下一次点击（tap-to-connect 模式）
            if (pinEl && pinEl.dataset.pinId === fromPin.id && pinEl.dataset.nodeId === fromPin.nodeId) {
                return;
            }

            if (pinEl) {
                // 正常命中其他引脚，尝试连接（finishConnectionAt 内部处理方向判断）
                finishConnectionAt(e.clientX, e.clientY);
                connected = true;
            }

            // 如果没有命中任何引脚 → 弹出选择器
            if (!connected && tempConnection) { // tempConnection 可能被 finishConnectionAt 清空
                showConnectionPicker(fromPin, fromDir, e.clientX, e.clientY);
            }

            tempConnection = null; // 无论成功与否都清空临时连接
        }
    }

    // 应用画布平移/缩放（网格 + 节点层 + SVG 三层同步变换）
    function applyCanvasTransform() {
        const layer = document.getElementById('bp-nodes-layer');
        const svg = document.getElementById('bp-svg');
        const canvas = document.getElementById('bp-canvas');
        const transform = `translate(${canvasOffset.x}px,${canvasOffset.y}px) scale(${scale})`;
        if (canvas) {
            canvas.style.backgroundPosition = `${canvasOffset.x}px ${canvasOffset.y}px`;
            canvas.style.backgroundSize = `${20 * scale}px ${20 * scale}px`;
        }
        if (layer) layer.style.transform = transform;
        if (svg) svg.style.transform = transform;
    }

    function updateSvgLines() {
        const svg = document.getElementById('bp-svg');
        if (!svg) return;
        svg.querySelectorAll('path').forEach(p => p.remove());
        const canvas = document.getElementById('bp-canvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        renderConnections(svg, canvasRect);
        if (tempConnection) renderTempConnection(svg);
    }

    // 增量更新版本：只修改已有 path 的 'd' 属性，不销毁/重建 DOM 元素
    // 用于拖动节点等高频场景，性能提升 5-10 倍
    function updateSvgLinesFast() {
        const svg = document.getElementById('bp-svg');
        if (!svg) return;

        // 复用已有的 path 元素，只更新路径数据
        const paths = svg.querySelectorAll('.bp-connection');
        const conns = currentDesign.connections;

        // 如果数量不匹配（有新增/删除），回退到完整更新
        if (paths.length !== conns.length) {
            updateSvgLines();
            return;
        }

        // 高频场景：整个帧共用同一个画布矩形，避免每条连线重复 getBoundingClientRect 触发布局
        const canvas = document.getElementById('bp-canvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };

        // 增量更新每条连线的 path
        for (let i = 0; i < conns.length; i++) {
            const conn = conns[i];
            const fromPos = getPinPosition(conn.fromNode, conn.fromPin, canvasRect);
            const toPos = getPinPosition(conn.toNode, conn.toPin, canvasRect);
            if (!fromPos || !toPos) continue;

            const path = paths[i];
            if (path && path.dataset.connId === conn.id) {
                path.setAttribute('d', createBezierPath(fromPos, toPos));
            } else {
                // ID 不匹配，说明状态不一致，回退
                updateSvgLines();
                return;
            }
        }

        // 临时连线也用增量方式更新（查找临时连线 path）
        let tempPath = svg.querySelector('path[stroke-dasharray]');
        if (tempConnection) {
            const d = createBezierPath(tempConnection.startPos, tempConnection.currentPos);
            if (tempPath) {
                tempPath.setAttribute('d', d);
                const color = TYPE_COLORS[tempConnection.pin.type || 'exec'];
                tempPath.setAttribute('stroke', color);
            } else {
                renderTempConnection(svg);
            }
        } else if (tempPath) {
            tempPath.remove();
        }
    }

    function onCanvasWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.max(0.3, Math.min(2, scale * delta));
        applyCanvasTransform();
        forceUpdateConnections(); // 缩放需要立即更新
    }

    // 触摸端无法使用 HTML5 拖放，点击变量项时在视图中心创建 get_variable 引用节点
    function addVariableNodeAtCenter(varKey) {
        const canvas = document.getElementById('bp-canvas');
        const v = (currentDesign.variables || {})[varKey];
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const cx = (rect.width / 2 - canvasOffset.x) / scale;
        const cy = (rect.height / 2 - canvasOffset.y) / scale;
        const node = createNode('get_variable', cx - 110, cy - 30);
        if (node) {
            node.data.variableName = varKey;
            node.data.variableDisplayName = v ? v.name : varKey;
            currentDesign.nodes.push(node);
            selectedNodeId = node.id;
            render();
        }
    }

    // 适应屏幕：计算所有节点包围盒，缩放到刚好容纳于画布
    function fitView() {
        const canvas = document.getElementById('bp-canvas');
        const cw = canvas ? canvas.clientWidth : window.innerWidth;
        const ch = canvas ? canvas.clientHeight : window.innerHeight;
        if (!currentDesign.nodes.length) {
            scale = 1; canvasOffset = { x: 40, y: 80 };
            applyCanvasTransform(); forceUpdateConnections();
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        currentDesign.nodes.forEach(n => {
            const el = document.querySelector(`.bp-node[data-node-id="${n.id}"]`);
            const w = el ? el.offsetWidth : 220;
            const h = el ? el.offsetHeight : 80;
            minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
        });
        const pad = 40;
        const bw = (maxX - minX) || 1, bh = (maxY - minY) || 1;
        const s = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 1.5);
        scale = Math.max(0.3, Math.min(2, s));
        canvasOffset.x = pad - minX * scale + (cw - pad * 2 - bw * scale) / 2;
        canvasOffset.y = pad - minY * scale + (ch - pad * 2 - bh * scale) / 2;
        applyCanvasTransform();
        forceUpdateConnections();
    }

    // 全局事件（模块加载时注册一次，避免每次 render 叠加监听器）
    // 使用 Pointer Events 统一鼠标 / 触摸 / 触控笔，移动端拖拽与平移依赖它
    document.addEventListener('pointermove', onGlobalMouseMove);
    document.addEventListener('pointerup', onGlobalMouseUp);
    document.addEventListener('pointercancel', onGlobalMouseUp);

    // 部分 Android WebView Pointer Events 支持不完整（不触发 pointerup/pointercancel），
    // 用 touchend 兜底：处理 dragNode 残留与连线残留。
    document.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        if (!touch) return;

        // 清理 activePointers（pointerId 不对应触摸，但指针映射必须清空）
        if (activePointers.size > 0) {
            activePointers.clear();
        }
        pinching = false;
        panning = false;

        // 优先处理节点拖拽残留（tap 时 pointerdown 设置了 dragNode 但 pointerup 可能不触发）
        if (dragNode) {
            forceUpdateConnections();
            dragNode = null;
            const canvas = document.getElementById('bp-canvas');
            if (canvas) canvas.style.cursor = 'grab';
        }

        // 再处理连线残留
        if (tempConnection) {
            const fromPin = tempConnection.pin;
            const fromDir = tempConnection.direction;
            const pinEl = _findPinAt(touch.clientX, touch.clientY);
            let connected = false;

            // 松手位置在同一引脚上 → 保持 tempConnection（tap-to-connect 模式）
            if (pinEl && pinEl.dataset.pinId === fromPin.id && pinEl.dataset.nodeId === fromPin.nodeId) {
                return;
            }

            if (pinEl) {
                finishConnectionAt(touch.clientX, touch.clientY);
                connected = true;
            }
            if (!connected && tempConnection) {
                showConnectionPicker(fromPin, fromDir, touch.clientX, touch.clientY);
            }
            tempConnection = null;
        }
    });

    // 阻止设计器内右键菜单（便于右键拖动画布）
    document.addEventListener('contextmenu', (e) => {
        if (designerActive()) e.preventDefault();
    });

    // ==================== 属性面板 ====================
    function createPropertyPanel() {
        const panel = document.createElement('div');
        panel.className = 'bp-property-panel open';
        panel.style.cssText = 'position:absolute;right:0;top:72px;bottom:0;width:260px;background:var(--bg-secondary);border-left:1px solid var(--border-color);padding:12px;z-index:10;overflow-y:auto;';

        const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
        if (!node) return panel;

        // 顶部条：拖动把手（移动端提示）+ 关闭按钮
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;';
        const handle = document.createElement('div');
        handle.style.cssText = 'flex:1;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        handle.innerHTML = '<div style="width:40px;height:4px;border-radius:2px;background:var(--border-color);"></div>';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.title = I18N.t('closeSettings') || '关闭';
        closeBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary);font-size:1.1rem;cursor:pointer;padding:2px 8px;line-height:1;flex-shrink:0;';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); selectedNodeId = null; render(); });
        // 点击把手区域也可关闭（移动端底部抽屉上滑把手关闭更自然）
        handle.addEventListener('click', () => { selectedNodeId = null; render(); });
        topBar.appendChild(handle);
        topBar.appendChild(closeBtn);
        panel.appendChild(topBar);

        const tpl = NODE_TEMPLATES[node.type];
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `font-size:1rem;font-weight:700;margin-bottom:12px;color:${tpl.color};`;
        titleEl.textContent = getText(tpl.title, tpl.titleEn, tpl.titleJa);
        panel.appendChild(titleEl);

        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

        if (node.type === 'dialogue') {
            form.innerHTML += createCharacterSelect(node);
            form.innerHTML += createTextArea(I18N.t('designerZhText'), 'text', node.data.text || '');
            form.innerHTML += createTextArea(I18N.t('designerEnText'), 'textEn', node.data.textEn || '');
            form.innerHTML += createTextArea(I18N.t('designerJaText'), 'textJa', node.data.textJa || '');
        } else if (node.type === 'narration') {
            form.innerHTML += createTextArea(I18N.t('designerZhText'), 'text', node.data.text || '');
            form.innerHTML += createTextArea(I18N.t('designerEnText'), 'textEn', node.data.textEn || '');
            form.innerHTML += createTextArea(I18N.t('designerJaText'), 'textJa', node.data.textJa || '');
        } else if (node.type === 'choice') {
            form.innerHTML += createChoiceEditor(node);
        } else if (node.type === 'condition') {
            const d = node.data;
            // 完整的比较运算符列表
            const operators = [
                ['>=', '≥ 大于等于'], ['>', '> 大于'], ['<=', '≤ 小于等于'], ['<', '< 小于'],
                ['==', '== 等于'], ['!=', '≠ 不等于'],
                ['&&', '&& 逻辑与'], ['||', '|| 逻辑或'],
                ['contains', '包含'], ['startsWith', '以...开头'], ['endsWith', '以...结尾'],
                ['empty', '为空'], ['notEmpty', '不为空']
            ];
            form.innerHTML += `
                <div style="font-size:0.8rem;font-weight:700;color:var(--accent-pink);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">🧮 ${I18N.t('designerConditionJudge')}</div>

                <!-- 左侧值 -->
                <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px;margin-bottom:10px;">
                    <label style="font-size:0.7rem;color:var(--text-muted);display:block;margin-bottom:6px;">${I18N.t('designerLeftValue')}</label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <select class="prop-select" data-key="leftType" style="width:72px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:5px 6px;color:var(--text-primary);font-size:0.75rem;">
                            <option value="variable" ${d.leftType === 'variable' ? 'selected' : ''}>${I18N.t('designerVarSelect')}</option>
                            <option value="direct" ${d.leftType === 'direct' ? 'selected' : ''}>${I18N.t('designerNumSelect')}</option>
                        </select>
                        ${d.leftType === 'variable'
                            ? createVariableSelectInline('leftVariable', d.leftVariable, '')
                            : createInputInline('leftDirect', String(d.leftDirect ?? 0), 'number', '80px')}
                    </div>
                </div>

                <!-- 运算符（居中突出） -->
                <div style="text-align:center;margin:8px 0;">
                    <select class="prop-select" data-key="operator" style="background:var(--accent-pink);color:#fff;border:1px solid var(--accent-pink);border-radius:var(--radius-sm);padding:6px 16px;color:#fff;font-size:0.85rem;font-weight:600;min-width:120px;">
                        ${operators.map(o => `<option value="${o[0]}" ${d.operator === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}
                    </select>
                </div>

                <!-- 右侧值 -->
                <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px;margin-bottom:10px;">
                    <label style="font-size:0.7rem;color:var(--text-muted);display:block;margin-bottom:6px;">${I18N.t('designerRightValue')}</label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <select class="prop-select" data-key="compareWith" style="width:72px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:5px 6px;color:var(--text-primary);font-size:0.75rem;">
                            <option value="direct" ${d.compareWith === 'direct' ? 'selected' : ''}>${I18N.t('designerNumSelect')}</option>
                            <option value="variable" ${d.compareWith === 'variable' ? 'selected' : ''}>${I18N.t('designerVarSelect')}</option>
                            <option value="pin" ${d.compareWith === 'pin' ? 'selected' : ''}>📌引脚</option>
                        </select>
                        ${d.compareWith === 'variable'
                            ? createVariableSelectInline('rightVariable', d.rightVariable, '')
                            : d.compareWith === 'pin'
                            ? `<span style="font-size:0.78rem;color:var(--accent-cyan);padding:4px 8px;background:rgba(34,211,238,0.1);border-radius:4px;">📌 ${I18N.t('designerPinConn')}</span>`
                            : createInputInline('rightDirect', String(d.rightDirect ?? 0), 'number', '80px')}
                    </div>
                </div>

                <!-- 当前条件预览 -->
                <div style="background:linear-gradient(135deg,rgba(236,72,153,0.08),rgba(168,85,247,0.08));border:1px dashed var(--accent-pink);border-radius:var(--radius-sm);padding:8px;text-align:center;">
                    <span style="font-size:0.75rem;color:var(--accent-pink);">当前条件：</span>
                    <strong id="condition-preview" style="font-size:0.85rem;color:var(--accent-pink);"></strong>
                </div>
            `;
        } else if (node.type === 'set_variable') {
            form.innerHTML += createVariableSelect('variableName', node.data.variableName, I18N.t('designerTargetVar'));
            form.innerHTML += `
                <div>
                    <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18N.t('designerOperation')}</label>
                    <select class="prop-select" data-key="operation" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;">
                        <option value="set" ${node.data.operation === 'set' ? 'selected' : ''}>= ${I18N.t('designerOpSet') || '赋值 (设为)'}</option>
                        <option value="add" ${node.data.operation === 'add' ? 'selected' : ''}>+ ${I18N.t('designerOpAdd') || '加法 (+)'}</option>
                        <option value="sub" ${node.data.operation === 'sub' ? 'selected' : ''}>- ${I18N.t('designerOpSub') || '减法 (-)'}</option>
                        <option value="mul" ${node.data.operation === 'mul' ? 'selected' : ''}>× ${I18N.t('designerOpMul') || '乘法 (×)'}</option>
                        <option value="div" ${node.data.operation === 'div' ? 'selected' : ''}>÷ ${I18N.t('designerOpDiv') || '除法 (÷)'}</option>
                    </select>
                </div>
            `;
            form.innerHTML += createInput(I18N.t('designerOperandValue') || '操作数值', 'operandValue', String(node.data.operandValue ?? 10), 'number');
        } else if (node.type === 'get_variable') {
            form.innerHTML += createVariableSelect('variableName', node.data.variableName, I18N.t('designerVarSelect'));
        } else if (node.type === 'chapter_begin') {
            form.innerHTML += createInput(I18N.t('designerChapterTitle'), 'chapterTitle', node.data.chapterTitle || '');
            form.innerHTML += createInput(I18N.t('designerSubtitle'), 'chapterSubtitle', node.data.chapterSubtitle || '');
        } else if (node.type === 'end_game' || node.type === 'end_chapter') {
            form.innerHTML += createSelect(I18N.t('designerEndingType'), 'endingType', node.data.endingType, [
                ['perfect', I18N.t('designerEndingPerfect')], ['good', I18N.t('designerEndingGood')], ['bad', I18N.t('designerEndingBad')], ['hidden', I18N.t('designerEndingHidden')]
            ]);
            form.innerHTML += createInput(I18N.t('designerEndingTitleLabel'), 'endingTitle', node.data.endingTitle || '');
            form.innerHTML += createTextArea(I18N.t('designerEndingDesc'), 'endingDesc', node.data.endingDesc || '');
            if (node.type === 'end_game') {
                form.innerHTML += createInput(I18N.t('designerRewardSeeds'), 'rewardSeeds', String(node.data.rewardSeeds || 3), 'number');
            }
        } else if (node.type === 'character_info') {
            form.innerHTML += createCharacterSelect(node, true);
        }

        panel.appendChild(form);
        return panel;
    }

    function createInput(label, key, value, type) {
        return `
            <div>
                <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${label}</label>
                <input class="prop-input" data-key="${key}" type="${type || 'text'}" value="${escapeHtml(value)}" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;">
            </div>
        `;
    }

    function createTextArea(label, key, value) {
        return `
            <div>
                <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${label}</label>
                <textarea class="prop-textarea" data-key="${key}" rows="2" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;resize:vertical;font-family:inherit;">${escapeHtml(value)}</textarea>
            </div>
        `;
    }

    function createSelect(label, key, value, options) {
        return `
            <div>
                <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${label}</label>
                <select class="prop-select" data-key="${key}" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;">
                    ${options.map(o => `<option value="${o[0]}" ${value === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}
                </select>
            </div>
        `;
    }

    function createCharacterSelect(node, forInfo) {
        const options = Object.entries(currentDesign.characters).map(([k, c]) =>
            `<option value="${k}" ${(forInfo ? node.data.characterId : node.data.characterId) === k ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`
        ).join('');
        const key = forInfo ? 'characterId' : 'characterId';
        return `
            <div>
                <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18N.t('designerCharacter')}</label>
                <select class="prop-select" data-key="${key}" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;">
                    <option value="">${I18N.t('designerNarrator')}</option>
                    ${options}
                </select>
            </div>
        `;
    }

    function createVariableSelectInline(key, value, label) {
        const options = Object.entries(currentDesign.variables || {}).map(([k, v]) =>
            `<option value="${k}" ${value === k ? 'selected' : ''}>${escapeHtml(v.name)}</option>`
        ).join('');
        return `<select class="prop-select" data-key="${key}" style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:4px 6px;color:var(--text-primary);font-size:0.75rem;flex:1;min-width:50px;">
            ${options}
        </select>`;
    }

    function createInputInline(key, value, type, width) {
        return `<input class="prop-input" data-key="${key}" type="${type || 'text'}" value="${escapeHtml(value)}" style="width:${width || '60px'};background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:4px 6px;color:var(--text-primary);font-size:0.75rem;">`;
    }

    function createVariableSelect(key, value, label) {
        const options = Object.entries(currentDesign.variables || {}).map(([k, v]) =>
            `<option value="${k}" ${value === k ? 'selected' : ''}>${escapeHtml(v.name)} (${v.type})</option>`
        ).join('');
        return `
            <div>
                <label style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:4px;">${label}</label>
                <select class="prop-select" data-key="${key}" style="width:100%;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:0.85rem;">
                    ${options}
                </select>
            </div>
        `;
    }

    function createChoiceEditor(node) {
        let html = `<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:6px;">${I18N.t('designerNodeChoice')}</div>`;
        node.data.choices.forEach((c, i) => {
            html += `
                <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:8px;margin-bottom:8px;">
                    <input class="choice-input" data-index="${i}" data-field="text" placeholder="${I18N.t('designerZhText')}" value="${escapeHtml(c.text)}" style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border-color);padding:4px 0;color:var(--text-primary);font-size:0.85rem;margin-bottom:4px;">
                    <input class="choice-input" data-index="${i}" data-field="textEn" placeholder="${I18N.t('designerEnText')}" value="${escapeHtml(c.textEn || '')}" style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border-color);padding:4px 0;color:var(--text-secondary);font-size:0.75rem;margin-bottom:4px;">
                    <input class="choice-input" data-index="${i}" data-field="textJa" placeholder="${I18N.t('designerJaText')}" value="${escapeHtml(c.textJa || '')}" style="width:100%;background:transparent;border:none;padding:4px 0;color:var(--text-secondary);font-size:0.75rem;">
                    <div style="display:flex;gap:4px;margin-top:6px;">
                        <select class="choice-tag" data-index="${i}" style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:2px 6px;color:var(--text-primary);font-size:0.75rem;">
                            <option value="neutral" ${c.tag === 'neutral' ? 'selected' : ''}>${I18N.t('tagCaution')}</option>
                            <option value="good" ${c.tag === 'good' ? 'selected' : ''}>${I18N.t('tagEmpathy')}</option>
                            <option value="bad" ${c.tag === 'bad' ? 'selected' : ''}>${I18N.t('tagRisk')}</option>
                            <option value="truth" ${c.tag === 'truth' ? 'selected' : ''}>${I18N.t('tagTruth')}</option>
                            <option value="risk" ${c.tag === 'risk' ? 'selected' : ''}>${I18N.t('tagRisk')}</option>
                        </select>
                        <button class="del-choice-btn" data-index="${i}" style="margin-left:auto;background:none;border:1px solid var(--accent-red);color:var(--accent-red);border-radius:var(--radius-sm);padding:2px 8px;font-size:0.7rem;cursor:pointer;">${I18N.t('designerDelete')}</button>
                    </div>
                </div>
            `;
        });
        html += `<button id="add-choice-btn" style="width:100%;background:transparent;border:1px dashed var(--accent-yellow);color:var(--accent-yellow);padding:6px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;">+ ${I18N.t('designerNodeChoice')}</button>`;
        return html;
    }

    function bindEvents() {
        document.getElementById('designer-title-input')?.addEventListener('input', (e) => {
            currentDesign.title = e.target.value;
        });

        document.querySelectorAll('.prop-input').forEach(el => {
            el.addEventListener('input', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    const key = e.target.dataset.key;
                    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
                    node.data[key] = val;
                    // 文本输入时只更新数据，不重绘整个面板，避免焦点丢失
                    updateNodePreview(node);
                }
            });
        });

        document.querySelectorAll('.prop-textarea').forEach(el => {
            // input 事件：实时保存
            el.addEventListener('input', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.data[e.target.dataset.key] = e.target.value;
                    // 文本输入时只更新数据，不重绘整个面板
                    updateNodePreview(node);
                }
            });
            // change 事件：确保失焦时也保存（兼容性备份）
            el.addEventListener('change', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.data[e.target.dataset.key] = e.target.value;
                    updateNodePreview(node);
                }
            });
            // blur 事件：确保失焦时保存
            el.addEventListener('blur', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.data[e.target.dataset.key] = e.target.value;
                    updateNodePreview(node);
                }
            });
        });


        document.querySelectorAll('.prop-select').forEach(el => {
            el.addEventListener('change', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.data[e.target.dataset.key] = e.target.value;
                    render();
                }
            });
        });

        document.querySelectorAll('.choice-input').forEach(el => {
            el.addEventListener('input', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (!node) return;
                const idx = parseInt(e.target.dataset.index, 10);
                const field = e.target.dataset.field;
                node.data.choices[idx][field] = e.target.value;
                updateChoiceOutput(node, idx);
                // 只更新节点预览，不刷新整个面板
                updateNodePreview(node);
            });
        });

        document.querySelectorAll('.choice-tag').forEach(el => {
            el.addEventListener('change', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (!node) return;
                const idx = parseInt(e.target.dataset.index, 10);
                node.data.choices[idx].tag = e.target.value;
                render();
            });
        });

        document.querySelectorAll('.del-choice-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
                if (!node) return;
                const idx = parseInt(e.target.dataset.index, 10);
                node.data.choices.splice(idx, 1);
                node.outputs = node.outputs.filter((o, i) => i !== idx);
                render();
            });
        });

        document.getElementById('add-choice-btn')?.addEventListener('click', () => {
            const node = currentDesign.nodes.find(n => n.id === selectedNodeId);
            if (!node) return;
            const idx = node.data.choices.length + 1;
            node.data.choices.push({ text: `选项${idx}`, textEn: `Choice ${idx}`, textJa: `選択肢${idx}`, tag: 'neutral' });
            node.outputs.push({
                id: genId('pin'),
                name: `选项${idx}`,
                nameEn: `Choice ${idx}`,
                nameJa: `選択肢${idx}`,
                type: 'exec',
                nodeId: node.id,
                tag: 'neutral'
            });
            render();
        });
    }

    function updateChoiceOutput(node, idx) {
        const choice = node.data.choices[idx];
        if (node.outputs[idx]) {
            node.outputs[idx].name = choice.text || `选项${idx + 1}`;
            node.outputs[idx].nameEn = choice.textEn || `Choice ${idx + 1}`;
            node.outputs[idx].nameJa = choice.textJa || `選択肢${idx + 1}`;
        }
    }

    function getPinByNodeIdAndId(nodeId, pinId) {
        for (const node of currentDesign.nodes) {
            if (node.id !== nodeId) continue;
            return [...node.inputs, ...node.outputs].find(p => p.id === pinId);
        }
        return null;
    }

    // ==================== Emoji 图标选择器 ====================
    const EMOJI_CATEGORIES = [
        { label: '😀', list: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
        { label: '❤️', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','♦️','♣️','♠️','♟️','🃏','🀄','🎴','🎭','🔇','🔈','🔉','🔊','🔔','🔕','🎼','🎵','🎶','🎙️','🎚️','🎛️','🎤','🎧','📢','📣','📯','🔔','🔕'] },
        { label: '👋', list: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','👳','🧕','🤵','👰','🤰','🤱','👨‍🍼','👩‍🍼','🧑‍🍼'] },
        { label: '🐱', list: ['🐱','🐈‍⬛','🐶','🐕','🦮','🐕‍🦺','🐩','🐺','🦊','🦝','🐱','🐈','🦁','🐯','🐅','🐆','🐴','🫎','🐎','🦄','🦓','🦌','🦬','🐮','🐂','🐃','🐄','🐷','🐖','🐗','🐽','🐏','🐑','🐐','🐪','🐫','🦙','🦒','🐘','🦣','🦏','🦛','🐭','🐁','🐀','🐹','🐰','🐇','🐿️','🦫','🦔','🦇','🐻','🐻‍❄️','🐨','🐼','🦥','🦦','🦨','🦘','🦡','🐾','🐉','🐲','🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'] },
        { label: '⭐', list: ['⭐','🌟','✨','⚡','💫','🔥','💥','☄️','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','🌈','🌅','🌄','🌠','🎆','🎇','🎑','💰','💴','💵','💶','💷','💸','💳','🧾','💎','⚖️','🪙','🔧','🔨','⚒️','🛠️','⚙️','🔩','⚙️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🪒','🧴','🧷','🧹','🧺','🧻','🪥','🪒'] },
        { label: '🌸', list: ['🌸','💮','🏵️','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🪴','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🥇','🥈','🥉','🏆','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️','🎰','🧩','🧸','♠️','♥️','♦️','♣️','♟️','🃏','🎴','🀄','🎏','🎐','🎎'] },
    ];

    // 已打开的 picker 引用，用于关闭
    let _activePicker = null;

    function showIconPicker(charKey, triggerEl) {
        // 如果已有打开的 picker，先关闭
        if (_activePicker) {
            _activePicker.remove();
            _activePicker = null;
        }

        const char = currentDesign.characters[charKey];
        if (!char) return;

        const picker = document.createElement('div');
        picker.className = 'bp-emoji-picker';
        picker.style.cssText = `position:fixed;z-index:10001;background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);max-width:320px;max-height:360px;overflow-y:auto;font-family:inherit;`;
        // 定位在触发元素附近
        const rect = triggerEl.getBoundingClientRect();
        picker.style.left = Math.min(rect.right + 4, window.innerWidth - 340) + 'px';
        picker.style.top = rect.top + 'px';

        let html = `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px;font-weight:600;">${I18N.t('designerEmojiPicker')}</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;

        // 当前选中标记
        const currentIcon = char.icon || '👤';
        EMOJI_CATEGORIES.forEach(cat => {
            cat.list.forEach(emoji => {
                const isSelected = emoji === currentIcon;
                html += `<span class="bp-emoji-opt" data-char="${charKey}" data-emoji="${emoji}" style="font-size:1.3rem;padding:3px 5px;border-radius:6px;cursor:pointer;border:2px solid ${isSelected ? 'var(--accent-green)' : 'transparent'};background:${isSelected ? 'rgba(74,125,255,0.15)' : 'transparent'};transition:all 0.15s;" title="${emoji}">${emoji}</span>`;
            });
        });
        html += '</div>';
        // 自定义输入
        html += `<div style="margin-top:10px;display:flex;gap:6px;align-items:center;">
            <input id="bp-custom-emoji" type="text" placeholder="✏ 粘贴任意 Emoji..." maxlength="4" style="flex:1;background:var(--bg);border:1px solid var(--border-color);border-radius:6px;padding:5px 8px;font-size:0.85rem;color:var(--text-primary);outline:none;">
            <button id="bp-confirm-emoji" style="background:var(--accent-green);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;">✓</button>
        </div>`;

        picker.innerHTML = html;
        document.body.appendChild(picker);
        _activePicker = picker;

        // 点击 Emoji 选项
        picker.querySelectorAll('.bp-emoji-opt').forEach(opt => {
            opt.onclick = () => {
                const key = opt.dataset.char;
                const emoji = opt.dataset.emoji;
                if (currentDesign.characters[key]) {
                    currentDesign.characters[key].icon = emoji;
                }
                picker.remove();
                _activePicker = null;
                render();
            };
            // hover 效果
            opt.onmouseenter = () => {
                if (opt.dataset.emoji !== currentIcon) opt.style.background = 'rgba(128,128,128,0.15)';
            };
            opt.onmouseleave = () => {
                if (opt.dataset.emoji !== currentIcon) opt.style.background = 'transparent';
            };
        });

        // 自定义输入确认
        const customInput = picker.querySelector('#bp-custom-emoji');
        const confirmBtn = picker.querySelector('#bp-confirm-emoji');
        const applyCustom = () => {
            const val = customInput.value.trim();
            if (val && currentDesign.characters[charKey]) {
                currentDesign.characters[charKey].icon = val;
            }
            picker.remove();
            _activePicker = null;
            render();
        };
        confirmBtn.onclick = applyCustom;
        customInput.onkeydown = (e) => { if (e.key === 'Enter') applyCustom(); };
        customInput.focus();

        // 点击外部关闭
        const closeOnOutside = (e) => {
            if (!picker.contains(e.target) && e.target !== triggerEl && !triggerEl.contains(e.target)) {
                picker.remove();
                _activePicker = null;
                document.removeEventListener('pointerdown', closeOnOutside);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', closeOnOutside), 0);
    }

    // ==================== 角色管理 ====================
    function addCharacter() {
        const id = 'char_' + genId();
        const names = prompt(I18N.t('designerCharName') + ' (zh/en/ja /)', I18N.t('designerAddChar') + '/New Character/新キャラ');
        if (!names) return;
        const [name, nameEn, nameJa] = names.split('/');
        currentDesign.characters[id] = {
            id,
            name: name.trim() || I18N.t('designerAddChar'),
            nameEn: nameEn?.trim() || 'New Character',
            nameJa: nameJa?.trim() || '新キャラ',
            icon: '👤',
            color: '#4a7dff'
        };
        render();
        // 渲染后自动打开该角色的图标选择器
        requestAnimationFrame(() => {
            const iconBtn = document.querySelector(`.bp-char-icon-btn[data-key="${id}"]`);
            if (iconBtn) showIconPicker(id, iconBtn);
        });
    }

    // ==================== 保存/导出/导入 ====================
    function save(silent) {
        if (!currentDesign.title) currentDesign.title = I18N.t('unnamedStory');
        SAVE.saveDesign(currentDesign);
        if (!silent) showMessage('✓ ' + I18N.t('designerSaveSuccess'));
    }

    function exportDesign() {
        const data = JSON.stringify(currentDesign, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (currentDesign.title || 'story') + '.blueprint.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importDesign() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    currentDesign = data;
                    ensureV2Compatibility();
                    render();
                    showMessage(I18N.t('designerImportSuccess'));
                } catch (err) {
                    alert(I18N.t('designerImportFail') + err.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    function showMessage(msg) {
        const container = document.getElementById('designer-canvas');
        if (!container) return;
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-card);border:1px solid var(--accent-green);border-radius:var(--radius-md);padding:16px 32px;font-size:1rem;color:var(--accent-green);z-index:10000;animation:cardAppear 0.3s ease;';
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }

    // ==================== 运行蓝图 ====================
    function playDesign() {
        save(true); // 静默保存，不弹"保存成功"提示
        const design = JSON.parse(JSON.stringify(currentDesign));
        const chapter = compileBlueprint(design);
        if (chapter) {
            STORY.addDynamicChapters([chapter]);
            GAME.startCustomStory(chapter);
        }
    }

    function playExistingDesign(designData) {
        currentDesign = JSON.parse(JSON.stringify(designData));
        ensureV2Compatibility();
        const chapter = compileBlueprint(currentDesign);
        if (chapter) {
            STORY.addDynamicChapters([chapter]);
            GAME.startCustomStory(chapter);
        }
    }

    function compileBlueprint(design) {
        const chId = 'bp_ch_' + design.id;
        const scenes = {};
        const runtimeVariables = {};

        Object.entries(design.variables || {}).forEach(([k, v]) => {
            runtimeVariables[k] = v.defaultValue;
        });

        // 生成所有场景节点
        const sceneNodes = design.nodes.filter(n => ['dialogue', 'narration', 'choice', 'chapter_begin', 'end_game', 'end_chapter'].includes(n.type));
        const visited = new Set();
        let sceneId = 0;

        // 找到起点
        const startNode = design.nodes.find(n => n.id === design.startNode) || design.nodes[0];
        if (!startNode) return null;

        // 为每个执行节点生成一个场景
        const nodeToScene = {};

        function buildSceneFrom(node, path) {
            if (nodeToScene[node.id]) return nodeToScene[node.id];
            const sid = `bp_scene_${++sceneId}`;
            nodeToScene[node.id] = sid;

            const messages = [];
            const choices = [];
            let nextScene = null;

            // 处理当前节点
            if (node.type === 'chapter_begin') {
                messages.push({ type: 'narrator', text: { zh: node.data.chapterTitle || '', en: node.data.chapterTitle || '', ja: node.data.chapterTitle || '' } });
            } else if (node.type === 'narration') {
                messages.push({ type: 'narrator', text: { zh: node.data.text || '', en: node.data.textEn || '', ja: node.data.textJa || '' } });
            } else if (node.type === 'dialogue') {
                const charId = node.data.characterId || 'narrator';
                const char = design.characters[charId] || design.characters.narrator || {};
                // 关键：把角色的显示信息直接打包进消息，
                // 避免运行时 STORY.getCharacter() 找不到用户自定义角色而 fallback 到 "玩家"
                messages.push({
                    type: 'character',
                    speaker: charId,
                    charName: char.name || '',
                    charColor: char.color || '#94a3b8',
                    charAvatar: char.icon || '👤',
                    text: { zh: node.data.text || '', en: node.data.textEn || '', ja: node.data.textJa || '' }
                });
            }

            // 获取下一个执行节点
            if (node.type === 'choice') {
                node.data.choices.forEach((choice, i) => {
                    const outPin = node.outputs[i];
                    if (!outPin) return;
                    const conn = design.connections.find(c => c.fromPin === outPin.id);
                    const target = conn ? design.nodes.find(n => n.id === conn.toNode) : null;
                    const targetScene = target ? buildSceneFrom(target) : null;
                    choices.push({
                        text: { zh: choice.text || '', en: choice.textEn || '', ja: choice.textJa || '' },
                        nextScene: targetScene,
                        effects: { flag_choice: true },
                        tag: choice.tag || 'neutral'
                    });
                });
            } else if (node.type === 'condition') {
                const d = node.data;
                const getVal = (type, variable, direct) => {
                    if (type === 'direct') return direct;
                    if (type === 'variable') return runtimeVariables[variable] !== undefined ? '(' + variable + ')' : 0;
                    return null; // pin 值在运行时解析
                };
                const rightVal = d.compareWith === 'pin' ? '📌' : (d.compareWith === 'variable' ? (d.rightVariable || '?') : (d.rightDirect ?? 0));
                const leftVal = d.leftType === 'variable' ? (d.leftVariable || '?') : (d.leftDirect ?? 0);
                const opStr = `${leftVal} ${d.operator || '>='} ${rightVal}`;

                const trueOut = node.outputs.find(o => o.key === 'out_true');
                const falseOut = node.outputs.find(o => o.key === 'out_false');
                const trueConn = trueOut ? design.connections.find(c => c.fromPin === trueOut.id) : null;
                const falseConn = falseOut ? design.connections.find(c => c.fromPin === falseOut.id) : null;
                const trueTarget = trueConn ? design.nodes.find(n => n.id === trueConn.toNode) : null;
                const falseTarget = falseConn ? design.nodes.find(n => n.id === falseConn.toNode) : null;

                // 条件节点显示判断式
                messages.push({ type: 'system', text: { zh: `[${I18N.t('designerConditionJudge')}: ${opStr}]`, en: `[If: ${opStr}]`, ja: `[分岐: ${opStr}]` } });

                // 选择：满足/不满足
                if (trueTarget || falseTarget) {
                    choices.push(
                        { text: { zh: I18N.t('designerCondSatisfied', { op: opStr }), en: `✅ Yes (${opStr})`, ja: `✅ はい (${opStr})` },
                          nextScene: trueTarget ? buildSceneFrom(trueTarget) : null, tag: 'truth' },
                        { text: { zh: I18N.t('designerCondNotMet'), en: I18N.t('designerCondNo'), ja: I18N.t('designerCondNo') },
                          nextScene: falseTarget ? buildSceneFrom(falseTarget) : null, tag: 'caution' }
                    );
                }
            } else if (node.type === 'set_variable') {
                // 变量运算节点：显示操作 + 执行运行时变更
                const v = design.variables[node.data.variableName] || {};
                const op = node.data.operation || 'add';
                const val = node.data.operandValue ?? 10;
                const opSymbols = { set: '=', add: '+', sub: '-', mul: '×', div: '÷' };
                const opNames = { set: I18N.t('designerOpSet') || '设为', add: I18N.t('designerOpAdd') || '增加', sub: I18N.t('designerOpSub') || '减少', mul: I18N.t('designerOpMul') || '乘以', div: I18N.t('designerOpDiv') || '除以' };
                const varName = v.name || node.data.variableName;
                messages.push({
                    type: 'system',
                    text: { zh: `🔢 ${varName} ${opSymbols[op] || op} ${val}`, en: `🔢 ${varName} ${opSymbols[op] || op} ${val}`, ja: `🔢 ${varName} ${opSymbols[op] || op} ${val}` },
                    varEffect: { variableName: node.data.variableName, operation: op, operandValue: val }
                });
                // 执行运行时变量更新
                if (runtimeVariables[node.data.variableName] !== undefined) {
                    const current = runtimeVariables[node.data.variableName];
                    let newValue;
                    switch (op) {
                        case 'set': newValue = val; break;
                        case 'add': newValue = current + val; break;
                        case 'sub': newValue = current - val; break;
                        case 'mul': newValue = current * val; break;
                        case 'div': newValue = val !== 0 ? Math.floor(current / val) : current; break;
                    }
                    runtimeVariables[node.data.variableName] = newValue;
                    // 在 varEffect 中记录新值，供 HUD 更新使用
                    messages[messages.length - 1].varEffect.newValue = newValue;
                }

                const outPin = node.outputs.find(o => o.key === 'out_exec');
                const conn = outPin ? design.connections.find(c => c.fromPin === outPin.id) : null;
                const target = conn ? design.nodes.find(n => n.id === conn.toNode) : null;
                nextScene = target ? buildSceneFrom(target) : null;
            } else if (node.type === 'end_game' || node.type === 'end_chapter') {
                scenes[sid] = {
                    id: sid,
                    messages,
                    isEnding: true,
                    endingId: 'bp_' + node.id,
                    endingTitleKey: node.data.endingTitle || node.data.chapterTitle || '结局',
                    endingDescKey: node.data.endingDesc || ''
                };
                return sid;
            } else {
                const outPin = node.outputs.find(o => o.key === 'out_exec') || node.outputs[0];
                const conn = outPin ? design.connections.find(c => c.fromPin === outPin.id) : null;
                const target = conn ? design.nodes.find(n => n.id === conn.toNode) : null;
                nextScene = target ? buildSceneFrom(target) : null;
            }

            scenes[sid] = {
                id: sid,
                messages,
                choices: choices.length > 0 ? choices : null,
                nextScene: nextScene || null
            };
            return sid;
        }

        // 收集需要在 HUD 中显示的变量
        const hudVariables = [];
        Object.entries(design.variables || {}).forEach(([key, v]) => {
            if (v.showOnHud !== false) { // 默认开启
                hudVariables.push({
                    key,
                    name: v.name || key,
                    type: v.type || 'number',
                    defaultValue: v.defaultValue ?? 0
                });
            }
        });

        const startScene = buildSceneFrom(startNode);

        return {
            id: chId,
            titleKey: 'customStory',
            subtitleKey: 'customStory',
            narrator: { zh: design.title || '', en: design.title || '', ja: design.title || '' },
            scenes,
            startScene: startScene,
            hudVariables, // 游戏运行时显示在界面上的变量列表
            runtimeInitialValues: { ...runtimeVariables } // 初始值快照
        };
    }

    // ==================== 工具函数 ====================
    function getText(zh, en, ja) {
        const lang = I18N ? I18N.getLanguage() : 'zh';
        if (lang === 'en') return en || zh;
        if (lang === 'ja') return ja || zh;
        return zh;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    return {
        open,
        close,
        playDesign,
        playExistingDesign,
        save
    };
})();
