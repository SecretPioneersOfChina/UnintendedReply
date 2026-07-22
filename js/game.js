/**
 * game.js - 核心游戏引擎
 * 《无心之举 / Unintended Reply》
 * 状态管理 · 对话渲染 · 选择系统 · 数据流控制
 */

const GAME = (function() {
    'use strict';

    // ==================== 游戏状态 ====================
    let state = {
        currentChapter: 'ch1',
        currentSceneId: 'ch1_start',
        flags: {
            trustMystery: 0,
            savedTimelines: 0,
            truthRevealed: false,
            choseSilence: false,
            ultimateQuestion: false,
            relationship_sq: 0,
            relationship_dc: 0,
        },
        messageHistory: [],
        playedMessages: new Set(),
        currentMessageIndex: 0,
        isPlaying: false,
        isPaused: false,
        currentChoices: [],
        autoSaveTimer: null,
        currentSpeaker: null,
        totalChoicesMade: 0,
        charactersMet: new Set()
    };

    // ==================== DOM 引用 ====================
    const dom = {};

    function cacheDom() {
        dom.app = document.getElementById('app');
        dom.splash = document.getElementById('splash-screen');
        dom.chatContainer = document.getElementById('chat-container');
        dom.messages = document.getElementById('messages');
        dom.choices = document.getElementById('choices');
        dom.choiceArea = document.getElementById('choice-area');
        dom.typingIndicator = document.getElementById('typing-indicator');
        dom.chapterBanner = document.getElementById('chapter-banner');
        dom.bannerTitle = document.getElementById('banner-title');
        dom.bannerSub = document.getElementById('banner-subtitle');
        dom.bannerChapter = document.getElementById('banner-chapter');
        dom.continueBtn = document.getElementById('banner-continue');
        dom.endingScreen = document.getElementById('ending-screen');
        dom.settingsOverlay = document.getElementById('settings-overlay');
        dom.langBtns = document.querySelectorAll('.lang-btn');
    }

    // ==================== 初始化 ====================
    function init() {
        cacheDom();

        // 事件监听
        document.addEventListener('languageChanged', onLanguageChanged);
        document.getElementById('btn-settings')?.addEventListener('click', showSettings);
        document.getElementById('btn-save')?.addEventListener('click', saveGame);
        document.getElementById('settings-close')?.addEventListener('click', hideSettings);

        // 语言按钮事件
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                I18N.setLanguage(lang);
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 结局按钮事件
        document.getElementById('ending-replay')?.addEventListener('click', replayChapter);
        document.getElementById('ending-menu')?.addEventListener('click', goToMainMenu);
        document.getElementById('ending-next')?.addEventListener('click', nextChapter);

        document.documentElement.lang = I18N.getLanguage();

        // 更新游戏标题
        const titleEl = document.getElementById('game-title');
        if (titleEl) titleEl.textContent = I18N.t('gameTitle');

        // 启动splash
        // 更新启动文字
        const splashText = document.getElementById('splash-text');
        if (splashText) splashText.textContent = I18N.t('splashLoading');

        setTimeout(() => {
            dom.splash.classList.add('hidden');
            dom.app.classList.add('active');
            showMainMenu();
        }, 2000);
    }

    // ==================== 主菜单 ====================
    function showMainMenu() {
        clearMessages();
        clearChoices();
        hideEndingScreen();
        hideVariableHud(); // 清除变量 HUD
        dom.choiceArea.style.display = 'none';

        // 顶部栏显示世界之种
        updateSeedDisplay();

        const titleMsg = document.createElement('div');
        titleMsg.className = 'message narrator visible';
        titleMsg.innerHTML = `
            <div class="narrator-content" style="border-color: var(--accent-cyan);">
                <div style="font-size:2.5rem;font-weight:800;margin-bottom:8px;background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple),var(--accent-cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                    ${I18N.t('gameTitle')}
                </div>
                <div style="font-size:0.95rem;color:var(--text-secondary);margin-bottom:16px;font-style:normal;letter-spacing:2px;">
                    ${I18N.t('gameSubtitle')}
                </div>
                <div id="main-menu-actions" style="display:flex;flex-direction:column;gap:10px;max-width:320px;margin:0 auto;">
                    <button id="btn-story-select" class="ending-btn primary" style="width:100%;padding:14px 28px;"><img src="img/stories.png" alt="" class="menu-btn-img"> ${I18N.t('selectStory')}</button>
                    <button id="btn-designer" class="ending-btn" style="width:100%;padding:12px 28px;"><img src="img/designer.png" alt="" class="menu-btn-img"> ${I18N.t('storyDesigner')}</button>
                    <button id="btn-continue" class="ending-btn" style="width:100%;padding:12px 28px;"><img src="img/continue.png" alt="" class="menu-btn-img"> ${I18N.t('continueGame')}</button>
                </div>
            </div>
        `;
        dom.messages.appendChild(titleMsg);

        document.getElementById('btn-story-select')?.addEventListener('click', () => {
            try { showStorySelect(); } catch (err) { showMainMenuError(err.message); }
        });
        document.getElementById('btn-designer')?.addEventListener('click', () => {
            try { DESIGNER.open(); } catch (err) { showMainMenuError(err.message); }
        });
        document.getElementById('btn-continue')?.addEventListener('click', () => {
            try { continueGame(); } catch (err) { showMainMenuError(err.message); }
        });

        const endings = SAVE.getUnlockedEndings();
        if (endings.length > 0) {
            const endingMsg = document.createElement('div');
            endingMsg.className = 'message system visible';
            endingMsg.innerHTML = `<div class="system-text">🏆 ${I18N.t('endingUnlocked', { name: endings.length })} (${endings.length})</div>`;
            dom.messages.appendChild(endingMsg);
        }
    }

    function showMainMenuError(msg) {
        const container = document.getElementById('main-menu-actions');
        if (!container) return;
        const err = document.createElement('div');
        err.style.cssText = 'color:var(--accent-red);font-size:0.85rem;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:8px;margin-top:8px;';
        err.textContent = '❌ ' + msg;
        container.appendChild(err);
    }

    function updateSeedDisplay() {
        const seeds = SAVE.getSeeds();
        let el = document.getElementById('seed-display');
        if (!el) {
            el = document.createElement('span');
            el.id = 'seed-display';
            el.style.cssText = 'font-size:0.8rem;color:var(--accent-yellow);margin-right:8px;';
            const actions = document.querySelector('.top-bar-actions');
            if (actions) actions.prepend(el);
        }
        el.textContent = `💠 ${getSeedName()} x${seeds}`;
    }

    function getSeedName() { return I18N.t('worldSeed'); }

    // ==================== 故事卡选择 ====================
    function showStorySelect() {
        clearMessages();
        clearChoices();
        hideVariableHud(); // 清除变量 HUD
        dom.choiceArea.style.display = 'none';

        updateSeedDisplay();

        const stories = STORY.getStoryCards();
        const msg = document.createElement('div');
        msg.className = 'message narrator visible';
        msg.innerHTML = `<div class="narrator-content" style="border-color:var(--accent-purple);">
            <div class="narrator-text" style="font-size:1.2rem;font-weight:700;font-style:normal;margin-bottom:8px;">🌌 ${I18N.t('selectStory')}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;">${I18N.t('seedBalance')}: 💠 ${SAVE.getSeeds()}</div>
        </div>`;
        dom.messages.appendChild(msg);

        const grid = document.createElement('div');
        grid.className = 'story-card-grid';
        grid.style.cssText = 'display:flex;flex-direction:column;gap:12px;max-width:400px;margin:16px auto;';

        stories.forEach(story => {
            const progress = SAVE.getCardProgress(story.id);
            const card = document.createElement('div');
            card.className = 'story-card';
            card.style.cssText = `background:var(--bg-card);border:1px solid ${story.color || 'var(--border-color)'};border-radius:var(--radius-md);padding:16px;cursor:pointer;transition:var(--transition);`;
            card.innerHTML = `
                <div style="font-size:1.8rem;margin-bottom:4px;">${story.icon || '📜'}</div>
                <div style="font-size:1.1rem;font-weight:700;color:${story.color || 'var(--text-primary)'};">${story.title}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0;">${story.description}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${I18N.t('difficulty')}: ${'⭐'.repeat(story.difficulty || 1)} | 🏆 ${progress.endings}/${story.totalEndings || 5}</div>
            `;
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    console.log('[GAME] Click story card:', story.id);
                    startStory(story.id);
                } catch (err) {
                    console.error('[GAME] startStory error:', err);
                    showMainMenuError('启动故事失败: ' + err.message);
                }
            });
            grid.appendChild(card);
        });

        // 设计的故事卡（含编辑/游玩/删除按钮）
        const designs = SAVE.getDesigns();
        designs.forEach(design => {
            const card = document.createElement('div');
            card.className = 'story-card story-card-custom';
            card.style.cssText = `background:var(--bg-card);border:1px solid var(--accent-yellow);border-radius:var(--radius-md);padding:16px;cursor:pointer;transition:var(--transition);border-style:dashed;position:relative;`;
            card.innerHTML = `
                <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                    <div style="flex:1;">
                        <div style="font-size:1.8rem;margin-bottom:4px;">✨</div>
                        <div style="font-size:1.1rem;font-weight:700;color:var(--accent-yellow);">${escapeHtml(design.title || I18N.t('unnamedStory'))}</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0;">${escapeHtml(design.description || '')}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">${I18N.t('customStory')}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;margin-top:10px;">
                    <button class="edit-design-btn" data-design-id="${design.id}" title="${I18N.t('designerEdit')}" style="flex:1;background:rgba(59,130,246,0.15);border:1px solid var(--accent-blue);color:var(--accent-blue);border-radius:var(--radius-sm);padding:5px;font-size:0.78rem;cursor:pointer;">✏️ ${I18N.t('designerEdit')}</button>
                    <button class="play-design-btn" data-design-id="${design.id}" title="${I18N.t('designerPlay')}" style="flex:1;background:rgba(34,197,94,0.15);border:1px solid var(--accent-green);color:var(--accent-green);border-radius:var(--radius-sm);padding:5px;font-size:0.78rem;cursor:pointer;">▶ ${I18N.t('designerPlay')}</button>
                    <button class="delete-design-btn" data-design-id="${design.id}" title="${I18N.t('designerDelete')}" style="flex-shrink:0;background:rgba(239,68,68,0.15);border:1px solid var(--accent-red);color:var(--accent-red);border-radius:var(--radius-sm);padding:5px 10px;font-size:0.78rem;cursor:pointer;">🗑</button>
                </div>
            `;
            // 编辑按钮 → 打开设计器编辑
            card.querySelector('.edit-design-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                DESIGNER.open(design);
            });
            // 游玩按钮 → 直接试玩
            card.querySelector('.play-design-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                DESIGNER.playExistingDesign(design);
            });
            // 删除按钮 → 确认删除
            card.querySelector('.delete-design-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteDesign(design);
            });
            grid.appendChild(card);
        });

        const backBtn = document.createElement('button');
        backBtn.className = 'ending-btn';
        backBtn.textContent = '← ' + I18N.t('mainMenu');
        backBtn.style.cssText = 'margin-top:8px;width:100%;padding:12px;';
        backBtn.addEventListener('click', showMainMenu);
        grid.appendChild(backBtn);

        dom.messages.appendChild(grid);
    }

    // ==================== 启动故事卡 ====================
    function startStory(cardId) {
        const card = STORY.getStoryCard(cardId);
        if (!card) { showMainMenuError('Story card not found: ' + cardId); return; }

        // 消耗世界之种（如果种子为0则允许免费开始一次，避免死循环）
        const currentSeeds = SAVE.getSeeds();
        if (currentSeeds > 0) {
            if (!SAVE.spendSeeds(1)) {
                showMainMenuError(`💠 ${I18N.t('noSeeds')}`);
                return;
            }
        } else if (currentSeeds <= 0) {
            // 种子不足时提示但允许继续
            console.log('[Game] 世界之种不足，允许免费开始以打破死循环');
        }

        updateSeedDisplay();
        state.currentStoryCard = cardId;
        state.currentChapter = card.chapters[0] || 'ch1';
        state.currentSceneId = (STORY.getChapter(state.currentChapter) || {}).startScene || 'ch1_start';
        state.flags = {};
        state.messageHistory = [];
        state.playedMessages = new Set();
        state.totalChoicesMade = 0;
        state.charactersMet = new Set();
        state.isCustomStory = false;

        dom.choiceArea.style.display = 'block';
        const ch = STORY.getChapter(state.currentChapter);
        if (!ch) {
            showMainMenuError('章节未找到: ' + state.currentChapter + '。可能故事文件未加载完成，请刷新页面。');
            return;
        }
        try {
            showChapterBanner(ch, () => {
                clearMessages();
                if (ch.narrator) {
                    const text = STORY.getText(ch.narrator);
                    addNarratorMessage(text, () => {
                        state.currentSceneId = ch.startScene;
                        setTimeout(() => playScene(ch.startScene), 400);
                    });
                } else {
                    state.currentSceneId = ch.startScene;
                    playScene(ch.startScene);
                }
            });
        } catch (err) {
            console.error('[GAME] startStory showChapterBanner error:', err);
            showMainMenuError('启动章节失败: ' + err.message);
        }
    }

    function hideEndingScreen() {
        dom.endingScreen.classList.remove('active');
    }

    // ==================== 试玩自定义故事 ====================
    // ==================== 删除自创故事并退还世界之种 ====================
    function confirmDeleteDesign(design) {
        const msg = document.createElement('div');
        msg.className = 'message narrator visible';
        msg.innerHTML = `<div class="narrator-content" style="border-color:var(--accent-red);">
            <div style="font-size:1.1rem;font-weight:700;color:var(--accent-red);margin-bottom:8px;">🗑 ${I18N.t('designerDelete')}</div>
            <div style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:16px;">
                ${I18N.t('designerConfirmDelChar', { name: escapeHtml(design.title || I18N.t('unnamedStory')) }).replace(/[^\n]*/, '')} ${I18N.t('costSeeds')}: 1 💠
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="confirm-delete-yes" style="background:var(--accent-red);color:#fff;border:none;padding:8px 24px;border-radius:var(--radius-md);cursor:pointer;font-size:0.9rem;">${I18N.t('designerDelete')}</button>
                <button id="confirm-delete-no" style="background:transparent;border:1px solid var(--border-color);color:var(--text-secondary);padding:8px 24px;border-radius:var(--radius-md);cursor:pointer;font-size:0.9rem;">${I18N.t('designerCancel')}</button>
            </div>
        </div>`;
        dom.messages.appendChild(msg);

        document.getElementById('confirm-delete-yes')?.addEventListener('click', () => {
            SAVE.deleteDesign(design.id);
            SAVE.addSeeds(1); // 退还世界之种
            updateSeedDisplay();
            showMainMenu(); // 刷新列表
        });
        document.getElementById('confirm-delete-no')?.addEventListener('click', () => {
            showStorySelect();
        });
    }

    function startCustomStory(chapter) {
        if (!chapter) return;
        state.currentChapter = chapter.id;
        state.currentSceneId = chapter.startScene;
        state.flags = {};
        state.messageHistory = [];
        state.playedMessages = new Set();
        state.totalChoicesMade = 0;
        state.charactersMet = new Set();
        // 标记为自定义故事（用于种子奖励）
        state.isCustomStory = true;

        dom.choiceArea.style.display = 'block';
        clearMessages();

        // 初始化变量 HUD 面板
        if (chapter.hudVariables && chapter.hudVariables.length > 0) {
            showVariableHud(chapter);
        }

        playScene(chapter.startScene);
    }

    // ==================== 变量 HUD 面板 ====================
    let _hudValues = {};       // 当前显示的变量值 { key: value }
    let _hudEl = null;         // HUD DOM 元素引用

    // 创建并显示变量 HUD 浮动面板
    function showVariableHud(chapter) {
        hideVariableHud(); // 先清除已有的

        const vars = chapter.hudVariables || [];
        if (vars.length === 0) return;

        // 初始化值（从编译时的初始快照）
        _hudValues = {};
        const initialValues = chapter.runtimeInitialValues || {};
        vars.forEach(v => {
            _hudValues[v.key] = initialValues[v.key] ?? v.defaultValue ?? 0;
        });

        // 创建 HUD 容器
        const hud = document.createElement('div');
        hud.id = 'bp-variable-hud';
        hud.style.cssText = `
            position:fixed;top:60px;right:16px;z-index:9999;
            background:rgba(15,15,25,0.92);backdrop-filter:blur(12px);
            border:1px solid rgba(74,125,255,0.3);border-radius:12px;
            padding:10px 14px;min-width:160px;max-width:240px;
            font-family:inherit;font-size:0.75rem;color:#e2e8f0;
            box-shadow:0 4px 24px rgba(0,0,0,0.5),0 0 40px rgba(74,125,255,0.08);
            animation:hudSlideIn 0.3s ease;user-select:none;
        `;

        let html = `<div style="font-size:0.7rem;color:rgba(148,163,184,0.8);margin-bottom:8px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">📊 ${I18N.t('hudTitle') || '变量面板'}</div>`;
        vars.forEach(v => {
            const val = _hudValues[v.key];
            const valColor = typeof val === 'number' ? (val > 0 ? '#34d399' : val < 0 ? '#f87171' : '#94a3b8') : '#c4b5fd';
            html += `
                <div class="bp-hud-item" data-var-key="${v.key}" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:rgba(226,232,240,0.7);font-size:0.72rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.name)}</span>
                    <span class="bp-hud-value" data-var-key="${v.key}" style="color:${valColor};font-weight:700;font-size:0.82rem;min-width:36px;text-align:right;font-variant-numeric:tabular-nums;">${val}</span>
                </div>
            `;
        });
        hud.innerHTML = html;

        // 添加动画 keyframes（如果不存在）
        if (!document.getElementById('bp-hud-style')) {
            const style = document.createElement('style');
            style.id = 'bp-hud-style';
            style.textContent = `
                @keyframes hudSlideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes hudValueFlash {
                    0% { color: #38bdf8; transform: scale(1.3); }
                    100% { color: inherit; transform: scale(1); }
                }
                .bp-hud-value.updated {
                    animation: hudValueFlash 0.5s ease;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(hud);
        _hudEl = hud;
    }

    // 更新单个变量的 HUD 显示值（带闪烁动画）
    function updateVariableHud(variableName, newValue) {
        if (!_hudEl) return;
        _hudValues[variableName] = newValue;

        const valueEl = _hudEl.querySelector(`.bp-hud-value[data-var-key="${variableName}"]`);
        if (valueEl) {
            const valColor = typeof newValue === 'number'
                ? (newValue > 0 ? '#34d399' : newValue < 0 ? '#f87171' : '#94a3b8')
                : '#c4b5fd';
            valueEl.style.color = valColor;
            valueEl.textContent = newValue;
            // 触发闪烁动画
            valueEl.classList.remove('updated');
            void valueEl.offsetWidth; // 强制 reflow 以重启动画
            valueEl.classList.add('updated');
        }
    }

    // 隐藏 HUD
    function hideVariableHud() {
        if (_hudEl) {
            _hudEl.remove();
            _hudEl = null;
        }
        _hudValues = {};
    }

    // ==================== 新游戏 ====================
    function startNewGame() {
        resetState();
        dom.choiceArea.style.display = 'block';
        startChapter('ch1');
    }

    function continueGame() {
        const saveData = SAVE.load(false);
        if (!saveData) {
            startNewGame();
            return;
        }
        restoreState(saveData);
        dom.choiceArea.style.display = 'block';
        // 重新渲染历史
        renderHistory(saveData.history || []);
        // 继续游戏的场景
        const scene = STORY.getScene(state.currentChapter, state.currentSceneId);
        if (scene) {
            if (scene.choices) {
                showChoices(scene.choices);
            } else if (scene.nextScene) {
                // 自动推进
                setTimeout(() => advanceScene(scene.nextScene), 800);
            } else if (scene.isEnding) {
                showEnding(scene.endingId, scene.endingTitleKey, scene.endingDescKey, scene.endingStats);
            }
        }
    }

    function resetState() {
        state = {
            currentChapter: 'ch1',
            currentSceneId: 'ch1_start',
            flags: {
                trustMystery: 0,
                savedTimelines: 0,
                truthRevealed: false,
                choseSilence: false,
                ultimateQuestion: false,
                relationship_sq: 0,
                relationship_dc: 0,
            },
            messageHistory: [],
            playedMessages: new Set(),
            currentMessageIndex: 0,
            isPlaying: false,
            isPaused: false,
            currentChoices: [],
            autoSaveTimer: null,
            currentSpeaker: null,
            totalChoicesMade: 0,
            charactersMet: new Set()
        };
    }

    function restoreState(savedState) {
        state.currentChapter = savedState.chapter;
        state.currentSceneId = savedState.sceneId;
        state.flags = savedState.flags || state.flags;
        state.messageHistory = savedState.history || [];
        state.playedMessages = new Set(savedState.playedMessages || []);
        state.currentMessageIndex = savedState.currentMessageIndex || 0;

        // 自动存档计时器恢复
        startAutoSave();
    }

    // ==================== 章节系统 ====================
    function startChapter(chapterId) {
        state.currentChapter = chapterId;
        const chapter = STORY.getChapter(chapterId);
        if (!chapter) return;

        // 显示章节横幅
        showChapterBanner(chapter, () => {
            clearMessages();
            // 如果有章首旁白且场景开头没有相同旁白，先展示
            if (chapter.narrator) {
                const text = STORY.getText(chapter.narrator);
                addNarratorMessage(text, () => {
                    state.currentSceneId = chapter.startScene;
                    setTimeout(() => playScene(chapter.startScene), 400);
                });
            } else {
                state.currentSceneId = chapter.startScene;
                playScene(chapter.startScene);
            }
        });
    }

    function showChapterBanner(chapter, callback) {
        // 计算故事内的章节号（不再用全局 index，否则混合故事会错位）
        // 例如：survive_ch1 在 STORY.chapters 全局里是第 9 个，但故事内是第 1 章
        let chapterNum = 1;
        if (state.currentStoryCard) {
            const card = STORY.getStoryCard(state.currentStoryCard);
            if (card && card.chapters) {
                const idx = card.chapters.indexOf(chapter.id);
                if (idx >= 0) chapterNum = idx + 1;
            }
        } else {
            // 回退：尝试从 story cards 中找到包含此章节的卡片
            const card = STORY.getStoryCards().find(c => c.chapters && c.chapters.indexOf(chapter.id) >= 0);
            if (card) {
                const idx = card.chapters.indexOf(chapter.id);
                if (idx >= 0) chapterNum = idx + 1;
                state.currentStoryCard = card.id;
            }
        }
        dom.bannerChapter.textContent = I18N.t('chapter', { n: chapterNum });
        dom.bannerTitle.textContent = I18N.t(chapter.titleKey);
        dom.bannerSub.textContent = I18N.t(chapter.subtitleKey);

        dom.chapterBanner.classList.add('active');

        dom.continueBtn.onclick = () => {
            dom.chapterBanner.classList.remove('active');
            if (callback) setTimeout(callback, 300);
        };
    }

    // ==================== 场景播放 ====================
    function playScene(sceneId) {
        state.currentSceneId = sceneId;
        const scene = STORY.getScene(state.currentChapter, sceneId);
        if (!scene) return;

        state.currentMessageIndex = 0;
        state.currentChoices = scene.choices || [];
        state.isPlaying = true;

        // 自动存档
        autoSave();

        playMessages(scene);
    }

    function playMessages(scene) {
        const messages = scene.messages;
        if (!messages || messages.length === 0) {
            showSceneChoices(scene);
            return;
        }

        playNextMessage(messages, scene);
    }

    function playNextMessage(messages, scene) {
        if (state.currentMessageIndex >= messages.length) {
            showSceneChoices(scene);
            return;
        }

        const msg = messages[state.currentMessageIndex];
        state.currentMessageIndex++;

        // 显示打字指示器
        if (msg.type === 'character' || msg.type === 'narrator') {
            showTyping(() => {
                renderMessage(msg, () => {
                    // 消息之间的延迟
                    const delay = msg.type === 'narrator' ? 800 : 400;
                    setTimeout(() => playNextMessage(messages, scene), delay);
                });
            });
        } else {
            renderMessage(msg, () => {
                setTimeout(() => playNextMessage(messages, scene), 300);
            });
        }
    }

    // ==================== 消息渲染 ====================
    function renderMessage(msg, callback) {
        const text = STORY.getText(msg.text);

        // 如果是变量变更消息，同步更新 HUD 面板
        if (msg.varEffect && msg.varEffect.variableName && msg.varEffect.newValue !== undefined) {
            updateVariableHud(msg.varEffect.variableName, msg.varEffect.newValue);
        }

        switch (msg.type) {
            case 'narrator':
                addNarratorMessage(text, callback);
                break;
            case 'character':
                // 优先用消息里直接打包的 charName/Color/Avatar（来自用户自定义角色），
                // fallback 到内置角色表
                const charInfo = msg.charName
                    ? { name: msg.charName, color: msg.charColor, avatar: msg.charAvatar }
                    : STORY.getCharacter(msg.speaker);
                if (!charInfo && !msg.charName) {
                    console.warn('[GAME] Character not found:', msg.speaker, '— available:', Object.keys(STORY.characters).join(','));
                }
                addCharacterMessage(msg.speaker, text, charInfo, callback);
                if (msg.speaker) state.charactersMet.add(msg.speaker);
                break;
            case 'system':
                addSystemMessage(text, callback);
                break;
            case 'player':
                addPlayerMessage(text, callback);
                break;
        }

        // 记录到历史（同时保存角色的显示信息，让历史回放也能正确显示）
        state.messageHistory.push({
            type: msg.type,
            speaker: msg.speaker,
            charName: msg.charName,
            charColor: msg.charColor,
            charAvatar: msg.charAvatar,
            text: msg.text,
            timestamp: Date.now()
        });

        // 若该消息有标签，则标记为已播放
        if (msg.important) {
            state.playedMessages.add(msg.id || text);
        }
    }

    function addNarratorMessage(text, callback) {
        const div = document.createElement('div');
        div.className = 'message narrator';
        div.innerHTML = `
            <div class="narrator-content">
                <div class="narrator-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
                <span class="narrator-speaker">✦ ${I18N.t('narrator')}</span>
            </div>
        `;
        appendAndAnimate(div, callback);
    }

    function addCharacterMessage(charId, text, charInfo, callback) {
        const div = document.createElement('div');
        div.className = 'message character';
        // 防御：如果角色信息缺失，使用默认值
        const safeCharInfo = charInfo || { nameKey: 'defaultPlayerName', color: '#94a3b8', avatar: '❓', description: '' };
        // 优先用 charInfo.name（用户自定义角色），
        // fallback 到 I18N.t(nameKey)（内置角色）
        const name = safeCharInfo.name || I18N.t(safeCharInfo.nameKey) || charId;
        const color = safeCharInfo.color || 'var(--text-secondary)';
        const time = getTimeString();

        div.innerHTML = `
            <div class="msg-header">
                <div class="msg-avatar" style="border-color:${color};color:${color};background:rgba(0,0,0,0.3);">${safeCharInfo.avatar || '?'}</div>
                <span class="msg-name" style="color:${color};">${name}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-bubble" style="border-color:${color}33;">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
        `;
        appendAndAnimate(div, callback);
    }

    function addPlayerMessage(text, callback) {
        const div = document.createElement('div');
        div.className = 'message player';
        const time = getTimeString();
        div.innerHTML = `
            <div class="msg-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
            <span class="msg-time">${time}</span>
        `;
        appendAndAnimate(div, callback);
    }

    function addSystemMessage(text, callback) {
        const div = document.createElement('div');
        div.className = 'message system';
        div.innerHTML = `<div class="system-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
        appendAndAnimate(div, callback);
    }

    function appendAndAnimate(element, callback) {
        dom.messages.appendChild(element);
        scrollToBottom();

        // 触发动画
        requestAnimationFrame(() => {
            element.classList.add('visible');
            scrollToBottom();
            if (callback) setTimeout(callback, 300);
        });
    }

    // ==================== 选择系统 ====================
    function showSceneChoices(scene) {
        // 如果有 playerReply
        if (scene.playerReply) {
            const text = STORY.getText(scene.playerReply);
            addNarratorMessage(text, () => {
                setTimeout(() => {
                    if (scene.choices) {
                        showChoices(scene.choices);
                    } else if (scene.nextScene) {
                        advanceScene(scene.nextScene);
                    } else if (scene.isEnding) {
                        showEnding(scene.endingId, scene.endingTitleKey, scene.endingDescKey, scene.endingStats);
                    } else if (scene.isTransition) {
                        handleTransition(scene);
                    }
                }, 400);
            });
        } else if (scene.choices) {
            showChoices(scene.choices);
        } else if (scene.nextScene) {
            advanceScene(scene.nextScene);
        } else if (scene.isEnding) {
            showEnding(scene.endingId, scene.endingTitleKey, scene.endingDescKey, scene.endingStats);
        } else if (scene.isTransition) {
            handleTransition(scene);
        } else {
            // 场景结束，回到章节选择或菜单
            showMainMenu();
        }
    }

    function showChoices(choices) {
        clearChoices();
        dom.choiceArea.style.display = 'block';

        // 根据变量条件过滤可选选项（高信任度才显示的选项等）
        const filtered = filterChoicesByCondition(choices);
        if (filtered.length === 0) {
            // 如果全部选项被过滤掉（玩家条件不满足），强制显示所有原始选项
            filtered.push(...choices);
        }

        filtered.forEach((choice, index) => {
            const text = STORY.getText(choice.text);
            const btn = document.createElement('button');
            btn.className = 'choice-btn';

            if (choice.tag) {
                const tagInfo = STORY.tagMap[choice.tag];
                if (tagInfo) {
                    const tagText = I18N.t(tagInfo.key);
                    btn.innerHTML = `<span class="choice-tag ${tagInfo.cls}">${tagText}</span> ${escapeHtml(text)}`;
                } else {
                    btn.textContent = escapeHtml(text);
                }
            } else {
                btn.textContent = escapeHtml(text);
            }

            btn.addEventListener('click', () => onChoiceSelected(choice, text, btn));
            dom.choices.appendChild(btn);
        });
    }

    function onChoiceSelected(choice, choiceText, btnElement) {
        // 禁用所有按钮
        document.querySelectorAll('.choice-btn').forEach(b => b.classList.add('disabled'));

        // 显示玩家选择的消息
        addPlayerMessage(choiceText, () => {
            // 显示结果提示
            if (choice.resultText) {
                const resultText = STORY.getText(choice.resultText);
                const resultDiv = document.createElement('div');
                resultDiv.className = `choice-result visible ${choice.resultType || 'neutral'}`;
                resultDiv.textContent = resultText;
                dom.messages.appendChild(resultDiv);
                scrollToBottom();
            }

            // 应用效果
            applyEffects(choice.effects);

            state.totalChoicesMade++;

            // 延迟后进入下一场景
            setTimeout(() => {
                clearChoices();
                if (choice.nextScene) {
                    advanceScene(choice.nextScene);
                }
            }, 800);
        });
    }

    function advanceScene(sceneId) {
        // 检查是否是跨章节跳转
        const currentChapter = STORY.getChapter(state.currentChapter);
        if (currentChapter && currentChapter.scenes[sceneId]) {
            playScene(sceneId);
        } else {
            // 在其他章节中查找
            for (const ch of STORY.chapters) {
                if (ch.scenes[sceneId]) {
                    if (ch.id !== state.currentChapter) {
                        // 切换章节
                        const targetChapter = ch;
                        state.currentChapter = ch.id;
                        showChapterBanner(targetChapter, () => {
                            clearMessages();
                            if (targetChapter.narrator) {
                                const text = STORY.getText(targetChapter.narrator);
                                addNarratorMessage(text, () => {
                                    setTimeout(() => playScene(sceneId), 400);
                                });
                            } else {
                                playScene(sceneId);
                            }
                        });
                        return;
                    } else {
                        playScene(sceneId);
                        return;
                    }
                }
            }
            console.warn(`Scene ${sceneId} not found`);
            showMainMenu();
        }
    }

    // ==================== 效果系统 ====================
    function applyEffects(effects) {
        if (!effects) return;

        // Flag & variable system
        for (const [key, value] of Object.entries(effects)) {
            if (key.startsWith('flag_')) {
                // 普通 flag（剧情标记）
                const flagName = key.substring(5);
                state.flags[flagName] = value;
            } else if (typeof value === 'boolean') {
                // 布尔变量（如 truthRevealed, choseSilence, ultimateQuestion）
                state.flags[key] = value;
            } else if (typeof value === 'number') {
                // 数字变量（好感度、信任度等）—— 自动累加
                state.flags[key] = (state.flags[key] || 0) + value;
            } else {
                state.flags[key] = value;
            }
        }
    }

    // ==================== 条件评估 ====================
    // 评估单个条件对象 { variable, operator, value } 是否满足当前 state
    // 支持的操作符: >=, >, <=, <, ==, !=, &&, ||, contains, startsWith, endsWith, empty, notEmpty
    function evaluateCondition(cond) {
        if (!cond) return true;
        const actual = state.flags[cond.variable] ?? 0;
        const expected = cond.value;
        const op = cond.operator || '==';
        switch (op) {
            case '>=': return actual >= expected;
            case '>': return actual > expected;
            case '<=': return actual <= expected;
            case '<': return actual < expected;
            case '==': return actual == expected;
            case '!=': return actual != expected;
            case 'contains': return String(actual).includes(String(expected));
            case 'startsWith': return String(actual).startsWith(String(expected));
            case 'endsWith': return String(actual).endsWith(String(expected));
            case 'empty': return actual == null || actual === '' || actual === 0 || actual === false;
            case 'notEmpty': return !evaluateCondition({ variable: cond.variable, operator: 'empty' });
            default: return true;
        }
    }

    // 过滤场景的 choices 数组：移除不满足 condition 的选项
    // choices[i].condition 形如 { variable: 'relationship_kara', operator: '>=', value: 5 }
    function filterChoicesByCondition(choices) {
        if (!choices || !Array.isArray(choices)) return choices;
        return choices.filter(c => {
            if (!c.condition) return true;
            if (Array.isArray(c.condition)) {
                // 数组形式：每个子条件都满足
                return c.condition.every(evaluateCondition);
            }
            return evaluateCondition(c.condition);
        });
    }

    // ==================== 过渡处理 ====================
    function handleTransition(scene) {
        if (scene.nextChapter) {
            autoSave();
            setTimeout(() => startChapter(scene.nextChapter), 1500);
        }
    }

    // ==================== 结局系统 ====================
    function checkAndShowEnding() {
        const ending = STORY.checkEnding(state.flags);
        if (ending) {
            showEnding(ending.id, ending.titleKey, ending.descKey);
        }
    }

    function showEnding(endingId, titleKey, descKey, stats) {
        dom.choiceArea.style.display = 'none';
        hideVariableHud(); // 结局时隐藏变量 HUD

        const ending = STORY.getEnding(endingId) || { type: 'good', icon: '🌅' };
        const title = I18N.t(titleKey);
        const desc = I18N.t(descKey);
        const typeText = I18N.t(`ending${ending.type.charAt(0).toUpperCase() + ending.type.slice(1)}`);

        // 记录结局
        SAVE.recordEnding(endingId, title);
        SAVE.updateStats({
            lastEnding: endingId,
            totalChoices: state.totalChoicesMade,
            charactersMet: state.charactersMet.size,
            endingsFound: SAVE.getEndingCount()
        });

        // 奖励世界之种（完成故事获得种子）
        let seedReward = 1;
        if (ending.type === 'perfect') seedReward = 3;
        else if (ending.type === 'good') seedReward = 2;
        
        // 检查该结局是否首次解锁（首次通关才奖励）
        const allEndings = SAVE.getUnlockedEndings();
        const isFirstClear = allEndings.filter(e => e.id === endingId).length <= 1;
        
        if (isFirstClear || ending.type === 'perfect') {
            const newSeeds = SAVE.addSeeds(seedReward);
            state.seedReward = seedReward; // 存储用于显示
        }

        // 先播放结束消息，再显示结局画面
        setTimeout(() => {
            dom.endingScreen.classList.add('active');
            document.querySelector('.ending-icon').textContent = ending.icon || '🌟';
            document.querySelector('.ending-title').textContent = title;
            document.querySelector('.ending-type').textContent = typeText;
            document.querySelector('.ending-description').textContent = desc;

            // 更新统计数据
            document.getElementById('stat-choices').textContent = state.totalChoicesMade;
            document.getElementById('stat-endings').textContent = SAVE.getEndingCount();

            // 显示种子奖励
            if (state.seedReward && state.seedReward > 0) {
                const seedInfo = document.createElement('div');
                seedInfo.style.cssText = 'margin-top:16px;padding:12px;background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.3);border-radius:8px;text-align:center;';
                seedInfo.innerHTML = `<div style="font-size:0.85rem;color:var(--accent-yellow);">💠 ${I18N.t('seedGainMsg', { n: state.seedReward, total: SAVE.getSeeds() })}</div>`;
                document.querySelector('.ending-stats').after(seedInfo);
                updateSeedDisplay();
            }

            // 结局类型类
            dom.endingScreen.className = 'active';
            dom.endingScreen.classList.add(`ending-${ending.type}`);

            // 显示下一章按钮
            const nextBtn = document.getElementById('ending-next');
            const currentChapterIndex = STORY.chapters.findIndex(ch => ch.id === state.currentChapter);
            if (currentChapterIndex < STORY.chapters.length - 1) {
                nextBtn.style.display = 'inline-block';
            } else {
                nextBtn.style.display = 'none';
            }
        }, 1000);
    }

    function replayChapter() {
        dom.endingScreen.classList.remove('active');
        const chapterId = state.currentChapter;
        resetState();
        state.currentChapter = chapterId;
        startChapter(chapterId);
    }

    function goToMainMenu() {
        dom.endingScreen.classList.remove('active');
        showMainMenu();
    }

    function nextChapter() {
        dom.endingScreen.classList.remove('active');
        const currentIndex = STORY.chapters.findIndex(ch => ch.id === state.currentChapter);
        const nextIndex = currentIndex + 1;
        if (nextIndex < STORY.chapters.length) {
            resetState();
            startChapter(STORY.chapters[nextIndex].id);
        }
    }

    // ==================== 打字指示器 ====================
    function showTyping(callback) {
        dom.typingIndicator.classList.add('visible');
        scrollToBottom();

        const delay = 600 + Math.random() * 400;
        setTimeout(() => {
            dom.typingIndicator.classList.remove('visible');
            if (callback) setTimeout(callback, 200);
        }, delay);
    }

    // ==================== UI 工具函数 ====================
    function clearMessages() {
        dom.messages.innerHTML = '';
    }

    function clearChoices() {
        dom.choices.innerHTML = '';
    }

    function scrollToBottom() {
        // 立即滚动一次，延迟再滚动一次确保渲染完成
        dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
        setTimeout(() => {
            dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
        }, 100);
    }

    function getTimeString() {
        const now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== 存档 ====================
    function autoSave() {
        SAVE.save(getSaveState(), true);
    }

    function saveGame() {
        const success = SAVE.save(getSaveState(), false);
        if (success) {
            showSaveNotification(I18N.t('saveSuccess'));
        }
    }

    function getSaveState() {
        return {
            currentChapter: state.currentChapter,
            currentSceneId: state.currentSceneId,
            flags: { ...state.flags },
            messageHistory: state.messageHistory,
            playedMessages: Array.from(state.playedMessages),
            currentMessageIndex: state.currentMessageIndex
        };
    }

    function renderHistory(history) {
        clearMessages();
        history.forEach(item => {
            if (item.type === 'narrator') {
                const text = STORY.getText(item.text);
                addNarratorMessage(text, null);
            } else if (item.type === 'character') {
                // 优先用历史中保存的 charName，避免用户自定义角色被查不到而显示 "玩家"
                const charInfo = item.charName
                    ? { name: item.charName, color: item.charColor, avatar: item.charAvatar }
                    : STORY.getCharacter(item.speaker);
                if (charInfo) {
                    const text = STORY.getText(item.text);
                    addCharacterMessage(item.speaker, text, charInfo, null);
                }
            } else if (item.type === 'player') {
                const text = STORY.getText(item.text);
                addPlayerMessage(text, null);
            } else if (item.type === 'system') {
                const text = STORY.getText(item.text);
                addSystemMessage(text, null);
            }
        });
    }

    function showSaveNotification(text) {
        const div = document.createElement('div');
        div.className = 'message system visible';
        div.innerHTML = `<div class="system-text">✓ ${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
        dom.messages.appendChild(div);
        scrollToBottom();
        setTimeout(() => div.remove(), 2000);
    }

    function startAutoSave() {
        if (state.autoSaveTimer) clearInterval(state.autoSaveTimer);
        state.autoSaveTimer = setInterval(() => {
            if (state.isPlaying) {
                autoSave();
            }
        }, 60000); // 每分钟自动存档
    }

    // ==================== 设置面板 ====================
    function showSettings() {
        dom.settingsOverlay.classList.add('active');
        // 高亮当前语言
        const currentLang = I18N.getLanguage();
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    function hideSettings() {
        dom.settingsOverlay.classList.remove('active');
    }

    // ==================== 语言切换 ====================
    function onLanguageChanged(e) {
        // 刷新当前界面
        const chapter = STORY.getChapter(state.currentChapter);
        if (chapter) {
            // 如果正在游戏中，刷新标题栏
            document.querySelector('.game-title').textContent = I18N.t('gameTitle');
        } else {
            showMainMenu();
        }
    }

    // ==================== 公共 API ====================
    return {
        init,
        startNewGame,
        continueGame,
        showMainMenu,
        replayChapter,
        goToMainMenu,
        nextChapter,
        showSettings,
        hideSettings,
        saveGame,
        startCustomStory
    };
})();

// 确保全局可访问（onclick等需要）
window.GAME = GAME;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    GAME.init();
});
