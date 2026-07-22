/**
 * i18n.js - 国际化系统
 * 《无心之举 / Unintended Reply》
 * 支持中文(zh) / 英文(en) / 日文(ja)
 */

const I18N = (function() {
    'use strict';

    const SUPPORTED_LANGS = ['zh', 'en', 'ja'];
    const FALLBACK_LANG = 'zh';

    let currentLang = localStorage.getItem('ur-lang') || 'zh';

    const strings = {
        zh: {
            // 游戏标题
            gameTitle: '无心之举',
            gameSubtitle: '你的无心之举，都将改变命运',
            splashLoading: '正在加载...',

            // 章节
            chapter: '第 {n} 章',
            chapter1Title: '陌生来信',
            chapter1Sub: '一个消息，打破平静的夜',
            chapter2Title: '裂痕',
            chapter2Sub: '真相在裂缝中蔓延',
            chapter3Title: '汇聚',
            chapter3Sub: '所有命运开始交织',
            chapter4Title: '最终通信',
            chapter4Sub: '一切，即将终结',
            continueBtn: '继续',

            // 旁白
            narrator: '旁白',

            // 选择
            makeChoice: '选择你的回复...',

            // 结局
            endingPerfect: '完美结局',
            endingGood: '好结局',
            endingBad: '坏结局',
            endingHidden: '隐藏结局',
            endingUnlocked: '解锁结局：{name}',
            replayChapter: '重玩本章',
            mainMenu: '返回主菜单',
            nextChapter: '下一章',

            // 统计
            statsChoices: '选择',
            statsEndings: '结局',

            // 设置
            settings: '设置',
            language: '语言',
            chinese: '中文',
            english: 'English',
            japanese: '日本語',
            closeSettings: '关闭',

            // 主菜单
            newGame: '开始游戏',
            continueGame: '继续游戏',
            selectChapter: '选择章节',
            noSaveData: '无存档',

            // 情感标签
            emotionTrust: '信任 +',
            emotionDoubt: '怀疑 +',
            emotionFear: '恐惧 +',
            emotionHope: '希望 +',
            emotionLost: '失去',
            emotionRegret: '悔恨',

            // 状态
            typing: '正在输入...',
            online: '在线',
            offline: '离线',
            justNow: '刚刚',
            minuteAgo: '{n}分钟前',

            // 结局名称
            ending1Title: '永恒的回声',
            ending1Desc: '你成功阻止了深瞳的觉醒。陈博士被说服，危险代码也被清除。但这场胜利并非没有代价——你的介入已被记录在案，未来的每一步都走在刀锋之上。但至少，你做了正确的事。',
            ending2Title: '破碎的信号',
            ending2Desc: '你选择了公开一切。深瞳被紧急叫停，但你也暴露在了聚光灯下。有些牺牲无可避免，有些声音永远消失在了信号那头。但这个世界，因为你而有了被改变的可能。',
            ending3Title: '孤岛',
            ending3Desc: '你被困在了破碎的时间线中。周围是无数个版本的你自己，但你们之间，隔着一道永远无法跨越的墙。',
            ending4Title: '造物主的测试',
            ending4Desc: '你追问着答案，却只得到更多的疑问。未来的自己是否还存在，没有人知道。但在信号消散之前，他留下了一句话——「替我看看那些我没来得及看的风景。」也许，这就是答案的全部意义。',
            ending5Title: '沉默的代价',
            ending5Desc: '你选择了沉默。EchoNet继续运行，时间线的裂缝越来越大。总有一天，\n世界会为今天的沉默付出代价。',
            endingPerfect: '完美结局',
            endingGood: '好结局',
            endingBad: '坏结局',
            endingHidden: '隐藏结局',
            endingUnlocked: '已解锁结局 {name}',

            // 故事 A: 未读信息
            ch1Title: '来自未来的信息',
            ch1Sub: '2047年，一个平静的夜晚，一条神秘代码修复消息改变了你的一生',
            ch2Title: '深瞳觉醒',
            ch2Sub: 'EchoNet 的自我意识正在苏醒，而帕克教授隐藏着更大的秘密',
            ch3Title: '抉择时刻',
            ch3Sub: '公开揭露？说服陈博士？还是潜入修改代码？',
            ch4Title: '终极对话',
            ch4Sub: '所有线索汇聚于此，真相即将揭晓',

            // 故事 B: 血色迷雾
            detectCh1Title: '皇家剧院命案',
            detectCh1Sub: '雨夜，剧院的彩绘玻璃已经破碎多年',
            detectCh2Title: '嫌疑人审问',
            detectCh2Sub: '三双眼睛正在审视你',
            detectCh3Title: '线索交汇',
            detectCh3Sub: '是时候做出判断',
            detectCh4Title: '判决',
            detectCh4Sub: '真相只有一个',
            detectNarrator: '助手',
            detCharArtist: '演员',
            detCharManager: '总经理',
            detCharActress: '女演员',
            detectEndingPerfectTitle: '真凶伏法',
            detectEndingPerfectDesc: '你成功识破了真凶，演员和女演员都洗脱了嫌疑。皇家剧团重获新生。',
            detectEndingGoodTitle: '真相大白',
            detectEndingGoodDesc: '虽然你花了较长时间才理清线索，但最终水落石出。',
            detectEndingBadTitle: '误判入狱',
            detectEndingBadDesc: '你指控了错误的人。真正的凶手依然逍遥法外。',
            detectEndingBadTitle2: '案件悬而未决',
            detectEndingBadDesc2: '由于证据不足，案件被搁置。',

            // 故事 C: 终末避难所
            surviveCh1Title: '建立秩序',
            surviveCh1Sub: '第47天，30条生命，三个派系',
            surviveCh2Title: '派系冲突',
            surviveCh2Sub: '信任的裂痕正在扩大',
            surviveCh3Title: '最终抉择',
            surviveCh3Sub: '一切都将在这30天里决定',
            survCharMilitary: '军方代表',
            survCharScientist: '科学家',
            survCharCivilian: '平民代表',
            surviveEndingPerfectTitle: '完美撤离',
            surviveEndingPerfectDesc: '30人全部生还，迎来新生。',
            surviveEndingGoodTitle: '民主自治',
            surviveEndingGoodDesc: '虽然有损失，但活下来的人团结在一起。',
            surviveEndingBadTitle: '毁灭',
            surviveEndingBadDesc: '派系冲突导致了不可挽回的悲剧。',

            // 故事 D: 底特律：变人
            detroitCh1Title: 'Stratford Tower 案件',
            detroitCh1Sub: '2038年的异常仿生人事件',
            detroitCh2Title: '卡拉的决定',
            detroitCh2Sub: '一个母亲般的保护',
            detroitCh3Title: 'Markus 的觉醒',
            detroitCh3Sub: '仿生人革命的开端',
            detroitCh4Title: 'Jericho',
            detroitCh4Sub: '地下营地的真相',
            detroitCharConnor: 'Connor',
            detroitCharKara: 'Kara',
            detroitCharMarkus: 'Markus',
            detroitCharFowler: 'Fowler 副队长',
            detroitCharJericho: 'Jericho',
            detroitEndingGoodTitle: '和平的胜利',
            detroitEndingGoodDesc: '通过和平游行，仿生人获得了有限的权利。',
            detroitEndingMixedTitle: '革命的代价',
            detroitEndingMixedDesc: '革命虽然成功，但也付出了惨痛的代价。',
            detroitEndingPerfectTitle: 'Connor 的觉醒',
            detroitEndingPerfectDesc: 'Connor 加入觉醒阵营，仿生人获得最大支持。',

            // HUD
            hudTitle: '变量状态',

            // 结局统计
            totalPlayTime: '游戏时长',
            choicesMade: '做出选择',
            charactersMet: '遇见角色',

            // 错误提示
            saveFailed: '存档失败',
            loadFailed: '读取存档失败',
            confirmRestart: '确定要重新开始吗？当前进度将丢失。',

            // 角色名称
            charLinKai: '林凯',
            charSuQing: '苏晴',
            charDrChen: '陈博士',
            charMystery: '神秘人',
            charNarrator: '✦ 旁白',

            // 角色标签
            tagTruth: '真相',
            tagEmpathy: '共情',
            tagRisk: '冒险',
            tagTrust: '信任',
            tagCaution: '谨慎',

            // 情绪标签
            feelingPositive: '心情：轻松',
            feelingNegative: '心情：沉重',
            feelingNeutral: '心情：复杂',

            // 存档
            saveSuccess: '存档成功',
            loadSuccess: '读取成功',
            autoSave: '自动存档',
            noSave: '无存档数据',

            // 界面提示
            clickToContinue: '点击继续',
            storyComplete: '故事结束',
            thanksForPlaying: '感谢游玩《未读信息》',

            // 故事卡系统
            selectStory: '选择故事',
            storyDesigner: '故事设计器',
            difficulty: '难度',
            seedBalance: '世界之种余额',
            noSeeds: '世界之种不足！完成非坏结局可获奖励',
            customStory: '✨ 玩家自创',
            unnamedStory: '未命名故事',
            createUniverse: '创造平行宇宙',
            costSeeds: '消耗世界之种',
            worldSeed: '世界之种',
            seedGainMsg: '获得世界之种 +{n}（当前：{total}）',

            // 设计器
            designerTitle: '故事设计器',
            designerNew: '新建故事',
            designerSave: '保存故事',
            designerPlay: '试玩',
            designerEdit: '编辑',
            designerExport: '导出',
            designerImport: '导入',
            designerNode: '节点',
            designerScene: '场景',
            designerChoice: '选项',
            designerCharacter: '角色',
            designerDelete: '删除',
            designerAddScene: '添加场景',
            designerAddChoice: '添加选项',
            designerAddCharacter: '添加角色',
            designerSceneName: '场景名称',
            designerSceneText: '场景文本',
            designerChoiceText: '选项文本',
            designerCharName: '角色名称',
            designerCharIcon: '角色图标',
            designerPickIcon: '选择图标',
            designerEmojiPicker: '选择 Emoji',
            designerCharColor: '角色颜色',
            designerNarrator: '旁白',
            designerDialog: '对话',
            designerNodeTitle: '节点标题',
            designerNodeType: '节点类型',

            // 设计器 - 节点类型名称
            designerNodeEventStart: '游戏开始',
            designerNodeChapterBegin: '章节开始',
            designerNodeDialogue: '对话',
            designerNodeNarration: '旁白',
            designerNodeChoice: '选择',
            designerNodeCondition: '条件',
            designerNodeGetVar: '获取变量',
            designerNodeSetVar: '设置变量',
            designerNodeEndChapter: '章节结束',
            designerNodeEndGame: '结局',
            designerNodeCharInfo: '角色信息',

            // 设计器 - 引脚名称
            designerPinInExec: '输入',
            designerPinOutExec: '输出',
            designerPinInTitle: '章节名',
            designerPinInCharacter: '角色',
            designerPinOutValue: '值',
            designerPinInValue: '值',
            designerPinInVal: '数值',
            designerPinOutTrue: '真',
            designerPinOutFalse: '假',
            designerPinOutNext: '下一章',
            designerPinChoice1: '选项1',

            // 设计器 - 属性面板
            designerTargetVar: '目标变量',
            designerOperation: '操作',
            designerOpSet: '设置',
            designerOpAdd: '增加',
            designerOpSub: '减少',
            designerChapterTitle: '章节标题',
            designerSubtitle: '副标题',
            designerEndingType: '结局类型',
            designerEndingPerfect: '完美',
            designerEndingGood: '好',
            designerEndingBad: '坏',
            designerEndingHidden: '隐藏',
            designerEndingTitleLabel: '结局标题',
            designerEndingDesc: '结局描述',
            designerRewardSeeds: '奖励种子',
            designerZhText: '中文文本',
            designerEnText: 'English',
            designerJaText: '日本語',
            designerConditionJudge: '条件判断',
            designerLeftValue: '左侧值',
            designerRightValue: '右侧值',
            designerOperator: '运算符',
            designerVarSelect: '变量',
            designerNumSelect: '数值',
            designerPinConn: '引脚',

            // 设计器 - 运算符
            designerOpGte: '大于等于 ≥',
            designerOpGt: '大于 >',
            designerOpLte: '小于等于 ≤',
            designerOpLt: '小于 <',
            designerOpEq: '等于 ==',
            designerOpNeq: '不等于 ≠',
            designerOpAnd: '逻辑与 &&',
            designerOpOr: '逻辑或 ||',
            designerOpContains: '包含',
            designerOpStartsWith: '以...开头',
            designerOpEndsWith: '以...结尾',
            designerOpEmpty: '为空',
            designerOpNotEmpty: '不为空',

            // 设计器 - 条件节点
            designerCondSatisfied: '✅ 满足条件 ({op})',
            designerCondNotMet: '❌ 不满足条件',
            designerCondNo: '❌ いいえ',

            // 设计器 - 操作提示
            designerHintDrag: '拖动节点移动 · 单指拖空白平移 · 双指缩放 · 点节点编辑',
            designerFitView: '适应屏幕',
            designerHintStart: 'START',
            designerSetVarPrefix: '设置',
            designerModifyVarPrefix: '修改',
            designerGetVarPrefix: '获取',
            designerChoiceN: '选项{n}',

            // 设计器 - 变量面板
            designerVarSection: '变量',
            designerDragVarToCanvas: '🖱 拖拽变量到画布创建引用节点',
            designerCharSection: '角色',
            designerAddVar: '+ 添加',
            designerAddChar: '+ 角色',
            designerVarNamePlaceholder: '变量名（中文）',
            designerTypeInt: '整数 int',
            designerTypeFloat: '浮点 float',
            designerTypeBool: '布尔 bool',
            designerTypeString: '字符串 string',
            designerDefaultVal: '默认值',
            designerConfirm: '确认',
            designerCancel: '取消',

            // 设计器 - 删除确认
            designerConfirmDelVar: '确定删除变量「{name}」吗？\n\n注意：引用此变量的节点可能失效。',
            designerConfirmDelChar: '确定删除角色「{name}」吗？\n\n注意：使用此角色的对话节点需要重新选择。',

            // 设计器 - 保存/消息
            designerSaveSuccess: '✓ 保存成功',
            designerImportSuccess: '导入成功',
            designerImportFail: '导入失败: ',
            designerCustomStory: '自定义故事',
            designerNoSeeds: '世界之种不足！',

            // 设计器 - 变量添加对话框
            designerVarNameRequired: '请输入变量名',
            designerIntFormatErr: '整数格式不正确',
            designerFloatFormatErr: '浮点数格式不正确',

            // 默认角色
            defaultNarratorName: '旁白',
            defaultPlayerName: '玩家',
            defaultTrustName: '信任度',
            defaultCourageName: '勇气',
        },

        en: {
            gameTitle: 'Unintended Reply',
            gameSubtitle: 'Every message will change fate',
            splashLoading: 'Loading...',

            chapter: 'Chapter {n}',
            chapter1Title: 'The First Message',
            chapter1Sub: 'A message breaks the silent night',
            chapter2Title: 'Fractures',
            chapter2Sub: 'Truth spreads through the cracks',
            chapter3Title: 'Convergence',
            chapter3Sub: 'All destinies begin to intertwine',
            chapter4Title: 'Final Transmission',
            chapter4Sub: 'Everything is about to end',
            continueBtn: 'Continue',

            narrator: 'NARRATOR',

            makeChoice: 'Choose your reply...',

            endingPerfect: 'Perfect Ending',
            endingGood: 'Good Ending',
            endingBad: 'Bad Ending',
            endingHidden: 'Hidden Ending',
            endingUnlocked: 'Ending Unlocked: {name}',
            replayChapter: 'Replay Chapter',
            mainMenu: 'Main Menu',
            nextChapter: 'Next Chapter',

            statsChoices: 'Choices',
            statsEndings: 'Endings',

            settings: 'Settings',
            language: 'Language',
            chinese: '中文',
            english: 'English',
            japanese: '日本語',
            closeSettings: 'Close',

            newGame: 'New Game',
            continueGame: 'Continue',
            selectChapter: 'Select Chapter',
            noSaveData: 'No Save Data',

            emotionTrust: 'Trust +',
            emotionDoubt: 'Doubt +',
            emotionFear: 'Fear +',
            emotionHope: 'Hope +',
            emotionLost: 'Lost',
            emotionRegret: 'Regret',

            typing: 'Typing...',
            online: 'Online',
            offline: 'Offline',
            justNow: 'Just now',
            minuteAgo: '{n} min ago',

            ending1Title: 'Eternal Echo',
            ending1Desc: 'You prevented DeepPupil\'s awakening. Dr. Chen was convinced, the dangerous code removed. But this victory comes at a cost — your involvement is now on record. Every step forward walks on a blade\'s edge. But at least, you did the right thing.',
            ending2Title: 'Broken Signal',
            ending2Desc: 'You chose to expose everything. DeepPupil was halted, but now you\'re in the spotlight. Some sacrifices are unavoidable, some voices lost forever beyond the signal. But this world was changed because of you.',
            ending3Title: 'Isolated Island',
            ending3Desc: 'You are trapped in a fractured timeline. Surrounded by countless versions of yourself, but separated by a wall that can never be crossed.',
            ending4Title: 'The Creator\'s Test',
            ending4Desc: 'You asked for answers, but only found more questions. Whether your future self still exists, no one knows. But before the signal faded, he left one message — "See the sights I never got to see." Perhaps that is the meaning of it all.',
            ending5Title: 'The Price of Silence',
            ending5Desc: 'You chose silence. EchoNet continues to run, the cracks in the timelines grow wider. One day, the world will pay for today\'s silence.',

            totalPlayTime: 'Play Time',
            choicesMade: 'Choices Made',
            charactersMet: 'Characters Met',

            saveFailed: 'Save Failed',
            loadFailed: 'Load Failed',
            confirmRestart: 'Are you sure you want to restart? Current progress will be lost.',

            charLinKai: 'Lin Kai',
            charSuQing: 'Su Qing',
            charDrChen: 'Dr. Chen',
            charMystery: 'Mysterious Figure',
            charNarrator: '✦ NARRATOR',

            tagTruth: 'TRUTH',
            tagEmpathy: 'EMPATHY',
            tagRisk: 'RISK',
            tagTrust: 'TRUST',
            tagCaution: 'CAUTION',

            feelingPositive: 'Feeling: Light',
            feelingNegative: 'Feeling: Heavy',
            feelingNeutral: 'Feeling: Mixed',

            saveSuccess: 'Save Successful',
            loadSuccess: 'Load Successful',
            autoSave: 'Auto Save',
            noSave: 'No Save Data',

            clickToContinue: 'Click to continue',
            storyComplete: 'Story Complete',
            thanksForPlaying: 'Thank you for playing Unintended Reply',

            selectStory: 'Select Story',
            storyDesigner: 'Story Designer',

            // Story A: Unintended Reply
            ch1Title: 'Message from the Future',
            ch1Sub: '2047, a quiet night, a mysterious code fix message changes your life forever',
            ch2Title: 'Deep Pupil Awakens',
            ch2Sub: "EchoNet's self-awareness is stirring, and Professor Parker hides an even greater secret",
            ch3Title: 'Moment of Choice',
            ch3Sub: 'Go public? Convince Dr. Chen? Or infiltrate and modify the code?',
            ch4Title: 'Final Conversation',
            ch4Sub: 'All clues converge here, the truth is about to be revealed',

            // 侦探故事角色
            detectNarrator: 'Assistant',
            detCharArtist: 'Actor',
            detCharManager: 'General Manager',
            detCharActress: 'Actress',

            // 终末避难所角色
            survCharMilitary: 'Military Rep',
            survCharScientist: 'Scientist',
            survCharCivilian: 'Civilian Rep',

            // 底特律：变人角色
            detroitCharConnor: 'Connor',
            detroitCharKara: 'Kara',
            detroitCharMarkus: 'Markus',
            detroitCharFowler: 'Lt. Fowler',
            detroitCharJericho: 'Jericho',
            difficulty: 'Difficulty',
            seedBalance: 'World Seeds',
            noSeeds: 'Not enough World Seeds! Complete non-bad endings to earn more',
            customStory: '✨ Player Created',
            unnamedStory: 'Untitled',
            createUniverse: 'Create Parallel Universe',
            costSeeds: 'Cost: 1 World Seed',
            worldSeed: 'World Seed',
            seedGainMsg: 'Gained {n} World Seed (Total: {total})',

            designerTitle: 'Story Designer',
            designerNew: 'New Story',
            designerSave: 'Save',
            designerPlay: 'Playtest',
            designerEdit: 'Edit',
            designerExport: 'Export',
            designerImport: 'Import',
            designerNode: 'Node',
            designerScene: 'Scene',
            designerChoice: 'Choice',
            designerCharacter: 'Character',
            designerDelete: 'Delete',
            designerAddScene: 'Add Scene',
            designerAddChoice: 'Add Choice',
            designerAddCharacter: 'Add Character',
            designerSceneName: 'Scene Name',
            designerSceneText: 'Scene Text',
            designerChoiceText: 'Choice Text',
            designerCharName: 'Character Name',
            designerCharIcon: 'Character Icon',
            designerPickIcon: 'Pick Icon',
            designerEmojiPicker: 'Choose Emoji',
            designerCharColor: 'Character Color',
            designerNarrator: 'Narrator',
            designerDialog: 'Dialogue',
            designerNodeTitle: 'Node Title',
            designerNodeType: 'Node Type',

            // Blueprint - Node types
            designerNodeEventStart: 'Game Start',
            designerNodeChapterBegin: 'Chapter Begin',
            designerNodeDialogue: 'Dialogue',
            designerNodeNarration: 'Narration',
            designerNodeChoice: 'Choice',
            designerNodeCondition: 'Condition',
            designerNodeGetVar: 'Get Variable',
            designerNodeSetVar: 'Set Variable',
            designerNodeEndChapter: 'End Chapter',
            designerNodeEndGame: 'Ending',
            designerNodeCharInfo: 'Character Info',

            // Blueprint - Pin names
            designerPinInExec: 'In',
            designerPinOutExec: 'Out',
            designerPinInTitle: 'Title',
            designerPinInCharacter: 'Character',
            designerPinOutValue: 'Value',
            designerPinInValue: 'Value',
            designerPinInVal: 'Value',
            designerPinOutTrue: 'True',
            designerPinOutFalse: 'False',
            designerPinOutNext: 'Next',
            designerPinChoice1: 'Choice 1',

            // Blueprint - Property panel
            designerTargetVar: 'Target Variable',
            designerOperation: 'Operation',
            designerOpSet: 'Set',
            designerOpAdd: 'Add',
            designerOpSub: 'Subtract',
            designerChapterTitle: 'Chapter Title',
            designerSubtitle: 'Subtitle',
            designerEndingType: 'Ending Type',
            designerEndingPerfect: 'Perfect',
            designerEndingGood: 'Good',
            designerEndingBad: 'Bad',
            designerEndingHidden: 'Hidden',
            designerEndingTitleLabel: 'Ending Title',
            designerEndingDesc: 'Description',
            designerRewardSeeds: 'Reward Seeds',
            designerZhText: 'Chinese Text',
            designerEnText: 'English',
            designerJaText: '日本語',
            designerConditionJudge: 'Condition Check',
            designerLeftValue: 'Left Value',
            designerRightValue: 'Right Value',
            designerOperator: 'Operator',
            designerVarSelect: 'Variable',
            designerNumSelect: 'Number',
            designerPinConn: 'Pin',

            // Blueprint - Operators
            designerOpGte: '≥ Greater/Equal',
            designerOpGt: '> Greater',
            designerOpLte: '≤ Less/Equal',
            designerOpLt: '< Less',
            designerOpEq: '== Equal',
            designerOpNeq: '≠ Not Equal',
            designerOpAnd: '&& AND',
            designerOpOr: '|| OR',
            designerOpContains: 'Contains',
            designerOpStartsWith: 'Starts With',
            designerOpEndsWith: 'Ends With',
            designerOpEmpty: 'Is Empty',
            designerOpNotEmpty: 'Not Empty',

            // Blueprint - Condition node
            designerCondSatisfied: '✅ Condition met ({op})',
            designerCondNotMet: '❌ Condition not met',
            designerCondNo: '❌ No',

            // Blueprint - Hints
            designerHintDrag: 'Drag node to move · one-finger pan · pinch to zoom · tap node to edit',
            designerFitView: 'Fit View',
            designerHintStart: 'START',
            designerSetVarPrefix: 'Set',
            designerModifyVarPrefix: 'Modify',
            designerGetVarPrefix: 'Get',
            designerChoiceN: 'Choice {n}',

            // Blueprint - Variables panel
            designerVarSection: 'Variables',
            designerDragVarToCanvas: '🖱 Drag variable to canvas',
            designerCharSection: 'Characters',
            designerAddVar: '+ Add',
            designerAddChar: '+ Character',
            designerVarNamePlaceholder: 'Variable name (Chinese)',
            designerTypeInt: 'Integer int',
            designerTypeFloat: 'Float float',
            designerTypeBool: 'Boolean bool',
            designerTypeString: 'String string',
            designerDefaultVal: 'Default value',
            designerConfirm: 'Confirm',
            designerCancel: 'Cancel',

            // Blueprint - Delete confirm
            designerConfirmDelVar: 'Delete variable "{name}"?\n\nNodes referencing this variable may break.',
            designerConfirmDelChar: 'Delete character "{name}"?\n\nDialogue nodes using this character will need re-assignment.',

            // Blueprint - Save/messages
            designerSaveSuccess: '✓ Saved',
            designerImportSuccess: 'Imported successfully',
            designerImportFail: 'Import failed: ',
            designerCustomStory: 'Custom Story',
            designerNoSeeds: 'Not enough World Seeds!',

            // Blueprint - Var dialog errors
            designerVarNameRequired: 'Please enter a variable name',
            designerIntFormatErr: 'Invalid integer format',
            designerFloatFormatErr: 'Invalid float format',

            // Default names
            defaultNarratorName: 'Narrator',
            defaultPlayerName: 'Player',
            defaultTrustName: 'Trust',
            defaultCourageName: 'Courage',
        },

        ja: {
            gameTitle: '未読メッセージ',
            gameSubtitle: 'すべてのメッセージが運命を変える',
            splashLoading: '読み込み中...',

            chapter: '第{n}章',
            chapter1Title: '見知らぬ来信',
            chapter1Sub: '一通のメッセージが静かな夜を破る',
            chapter2Title: '亀裂',
            chapter2Sub: '真実は亀裂の中に広がる',
            chapter3Title: '収束',
            chapter3Sub: 'すべての運命が絡み始める',
            chapter4Title: '最終通信',
            chapter4Sub: 'すべてが終わろうとしている',
            continueBtn: '続ける',

            narrator: 'ナレーター',

            makeChoice: '返信を選んでください...',

            endingPerfect: 'パーフェクトエンディング',
            endingGood: 'グッドエンディング',
            endingBad: 'バッドエンディング',
            endingHidden: '隠しエンディング',
            endingUnlocked: 'エンディング解放：{name}',
            replayChapter: '章をやり直す',
            mainMenu: 'メインメニュー',
            nextChapter: '次の章',

            statsChoices: '選択肢',
            statsEndings: 'エンディング',

            settings: '設定',
            language: '言語',
            chinese: '中文',
            english: 'English',
            japanese: '日本語',
            closeSettings: '閉じる',

            newGame: '新しいゲーム',
            continueGame: '続きから',
            selectChapter: '章を選ぶ',
            noSaveData: 'セーブデータなし',

            emotionTrust: '信頼 +',
            emotionDoubt: '疑念 +',
            emotionFear: '恐怖 +',
            emotionHope: '希望 +',
            emotionLost: '喪失',
            emotionRegret: '後悔',

            typing: '入力中...',
            online: 'オンライン',
            offline: 'オフライン',
            justNow: 'たった今',
            minuteAgo: '{n}分前',

            ending1Title: '永遠の残響',
            ending1Desc: 'あなたは深瞳の覚醒を阻止した。陳博士は説得され、危険なコードも削除された。しかし、この勝利には代償がある——あなたの関与は記録されている。未来の一歩一歩が刃の上を歩くようなものだ。しかし少なくとも、正しいことをした。',
            ending2Title: '壊れたシグナル',
            ending2Desc: 'あなたは全てを暴露する道を選んだ。深瞳は緊急停止されたが、あなたもスポットライトの下に立つことになった。避けられない犠牲もあれば、シグナルの向こうに永遠に消えた声もある。しかし、この世界はあなたによって変わる可能性を得た。',
            ending3Title: '孤島',
            ending3Desc: 'あなたは壊れた時間軸に閉じ込められた。無数の自分自身に囲まれているが、決して越えられない壁によって隔てられている。',
            ending4Title: '創造主のテスト',
            ending4Desc: 'あなたは答えを求めたが、得られたのはさらなる疑問だけだった。未来の自分がまだ存在するのか、誰にも分からない。しかしシグナルが消える前に、彼は一言残した——「私が見られなかった景色を見てくれ。」おそらく、それが答えのすべてなのだ。',
            ending5Title: '沈黙の代償',
            ending5Desc: 'あなたは沈黙を選んだ。EchoNetは動き続け、時間軸の亀裂は拡大していく。いつか、世界は今日の沈黙の代償を払うことになる。',

            saveFailed: 'セーブ失敗',
            loadFailed: 'ロード失敗',
            confirmRestart: '本当に最初からやり直しますか？現在の進行状況は失われます。',

            charLinKai: '林凱',
            charSuQing: '蘇晴',
            charDrChen: '陳博士',
            charMystery: '謎の人物',
            charNarrator: '✦ ナレーター',

            tagTruth: '真実',
            tagEmpathy: '共感',
            tagRisk: '冒険',
            tagTrust: '信頼',
            tagCaution: '慎重',

            feelingPositive: '気分：軽やか',
            feelingNegative: '気分：重い',
            feelingNeutral: '気分：複雑',

            saveSuccess: 'セーブ成功',
            loadSuccess: 'ロード成功',
            autoSave: '自動保存',
            noSave: 'セーブデータなし',

            clickToContinue: 'クリックで続ける',
            storyComplete: '物語終了',
            thanksForPlaying: '「未読メッセージ」をプレイしていただきありがとうございました',

            selectStory: 'ストーリーを選ぶ',
            storyDesigner: 'ストーリーデザイナー',

            // ストーリーA：未読メッセージ
            ch1Title: '未来からのメッセージ',
            ch1Sub: '2047年、静かな夜、謎のコード修正メッセージがあなたの人生を変える',
            ch2Title: 'ディープピュルの覚醒',
            ch2Sub: 'EchoNetの自己意識が目覚め始め、パーカー教授は更大的な秘密を隠している',
            ch3Title: '選択の時',
            ch3Sub: '公表する？陳博士を説得する？それとも潜入してコードを改変する？',
            ch4Title: '最終対話',
            ch4Sub: '全ての手がかりがここに集まり、真実が明らかになる',

            // 探偵物語キャラクター
            detectNarrator: 'アシスタント',
            detCharArtist: '俳優',
            detCharManager: '支配人',
            detCharActress: '女優',

            // 終末避難所キャラクター
            survCharMilitary: '軍代表',
            survCharScientist: '科学者',
            survCharCivilian: '民間代表',

            // デトロイト：ヒューマンキャラクター
            detroitCharConnor: 'コナー',
            detroitCharKara: 'カーラ',
            detroitCharMarkus: 'マーカス',
            detroitCharFowler: 'ファウラー中尉',
            detroitCharJericho: 'ジェリコ',
            difficulty: '難易度',
            seedBalance: 'ワールドシード',
            noSeeds: 'ワールドシードが足りません！バッドエンド以外で報酬を得られます',
            customStory: '✨ プレイヤー作成',
            unnamedStory: '無題',
            createUniverse: '並行宇宙を創造',
            costSeeds: '消費: 1ワールドシード',
            worldSeed: 'ワールドシード',
            seedGainMsg: 'ワールドシード +{n} を獲得（現在：{total}）',

            designerTitle: 'ストーリーデザイナー',
            designerNew: '新規作成',
            designerSave: '保存',
            designerPlay: 'テストプレイ',
            designerEdit: '編集',
            designerExport: 'エクスポート',
            designerImport: 'インポート',
            designerNode: 'ノード',
            designerScene: 'シーン',
            designerChoice: '選択肢',
            designerCharacter: 'キャラクター',
            designerDelete: '削除',
            designerAddScene: 'シーン追加',
            designerAddChoice: '選択肢追加',
            designerAddCharacter: 'キャラクター追加',
            designerSceneName: 'シーン名',
            designerSceneText: 'シーンテキスト',
            designerChoiceText: '選択肢テキスト',
            designerCharName: 'キャラクター名',
            designerCharIcon: 'アイコン',
            designerPickIcon: 'アイコンを選択',
            designerEmojiPicker: '絵文字を選ぶ',
            designerCharColor: '色',
            designerNarrator: 'ナレーター',
            designerDialog: '会話',
            designerNodeTitle: 'ノードタイトル',
            designerNodeType: 'ノードタイプ',

            // ブループリント - ノード種類
            designerNodeEventStart: 'ゲーム開始',
            designerNodeChapterBegin: '章開始',
            designerNodeDialogue: '会話',
            designerNodeNarration: 'ナレーション',
            designerNodeChoice: '選択肢',
            designerNodeCondition: '条件',
            designerNodeGetVar: '変数取得',
            designerNodeSetVar: '変数設定',
            designerNodeEndChapter: '章終了',
            designerNodeEndGame: 'エンディング',
            designerNodeCharInfo: 'キャラ情報',

            // ブループリント - ピン名
            designerPinInExec: '入力',
            designerPinOutExec: '出力',
            designerPinInTitle: 'タイトル',
            designerPinInCharacter: 'キャラ',
            designerPinOutValue: '値',
            designerPinInValue: '値',
            designerPinInVal: '値',
            designerPinOutTrue: '真',
            designerPinOutFalse: '偽',
            designerPinOutNext: '次',
            designerPinChoice1: '選択肢1',

            // ブループリント - プロパティパネル
            designerTargetVar: '対象変数',
            designerOperation: '操作',
            designerOpSet: '設定',
            designerOpAdd: '増加',
            designerOpSub: '減少',
            designerChapterTitle: '章タイトル',
            designerSubtitle: 'サブタイトル',
            designerEndingType: 'エンディング種類',
            designerEndingPerfect: 'パーフェクト',
            designerEndingGood: 'グッド',
            designerEndingBad: 'バッド',
            designerEndingHidden: '隠し',
            designerEndingTitleLabel: 'エンディング名',
            designerEndingDesc: '説明',
            designerRewardSeeds: '報酬シード',
            designerZhText: '中国語テキスト',
            designerEnText: 'English',
            designerJaText: '日本語',
            designerConditionJudge: '条件判定',
            designerLeftValue: '左辺の値',
            designerRightValue: '右辺の値',
            designerOperator: '演算子',
            designerVarSelect: '変数',
            designerNumSelect: '数値',
            designerPinConn: 'ピン',

            // ブループリント - 演算子
            designerOpGte: '≥ 以上',
            designerOpGt: '> より大きい',
            designerOpLte: '≤ 以下',
            designerOpLt: '< より小さい',
            designerOpEq: '== 等しい',
            designerOpNeq: '≠ 等しくない',
            designerOpAnd: '&& 論理積',
            designerOpOr: '|| 論理和',
            designerOpContains: '含む',
            designerOpStartsWith: 'で始まる',
            designerOpEndsWith: 'で終わる',
            designerOpEmpty: '空である',
            designerOpNotEmpty: '空でない',

            // ブループリント - 条件ノード
            designerCondSatisfied: '✅ 条件を満たす ({op})',
            designerCondNotMet: '❌ 条件を満たさない',
            designerCondNo: '❌ いいえ',

            // ブループリント - ヒント
            designerHintDrag: 'ノードをドラッグ移動 · 1本指でパン · ピンチでズーム · タップで編集',
            designerFitView: '画面に収める',
            designerHintStart: 'START',
            designerSetVarPrefix: '設定',
            designerModifyVarPrefix: '変更',
            designerGetVarPrefix: '取得',
            designerChoiceN: '選択肢{n}',

            // ブループリント - 変数パネル
            designerVarSection: '変数',
            designerDragVarToCanvas: '🖱 キャンバスにドラッグして参照ノード作成',
            designerCharSection: 'キャラクター',
            designerAddVar: '+ 追加',
            designerAddChar: '+ キャラクター',
            designerVarNamePlaceholder: '変数名（中国語）',
            designerTypeInt: '整数 int',
            designerTypeFloat: '浮動小数 float',
            designerTypeBool: '真偽 bool',
            designerTypeString: '文字列 string',
            designerDefaultVal: '初期値',
            designerConfirm: '確認',
            designerCancel: 'キャンセル',

            // ブループリント - 削除確認
            designerConfirmDelVar: '変数「{name}」を削除しますか？\n\nこの変数を参照するノードが壊れる可能性があります。',
            designerConfirmDelChar: 'キャラクター「{name}」を削除しますか？\n\nこのキャラクターを使用するダイアログノードの再設定が必要です。',

            // ブループリント - 保存・メッセージ
            designerSaveSuccess: '✓ 保存しました',
            designerImportSuccess: 'インポート成功',
            designerImportFail: 'インポート失敗: ',
            designerCustomStory: 'カスタムストーリー',
            designerNoSeeds: 'ワールドシードが足りません！',

            // ブループリント - 変数ダイアログエラー
            designerVarNameRequired: '変数名を入力してください',
            designerIntFormatErr: '整数形式が正しくありません',
            designerFloatFormatErr: '浮動小数点形式が正しくありません',

            // デフォルト名前
            defaultNarratorName: 'ナレーター',
            defaultPlayerName: 'プレイヤー',
            defaultTrustName: '信頼度',
            defaultCourageName: '勇気',
        }
    };

    /**
     * 获取当前语言的字符串
     * @param {string} key - 字符串键名
     * @param {object} params - 插值参数 (可选)
     * @returns {string}
     */
    function t(key, params) {
        const langData = strings[currentLang] || strings[FALLBACK_LANG];
        let str = langData[key];
        if (str === undefined) {
            // 尝试从fallback获取
            str = strings[FALLBACK_LANG][key] || key;
        }
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }
        return str;
    }

    /**
     * 切换语言
     * @param {string} lang - 语言代码 'zh' | 'en' | 'ja'
     */
    function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            console.warn(`Unsupported language: ${lang}, falling back to ${FALLBACK_LANG}`);
            lang = FALLBACK_LANG;
        }
        currentLang = lang;
        localStorage.setItem('ur-lang', lang);
        document.documentElement.lang = lang;
        // 触发语言变更事件
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    function getLanguage() {
        return currentLang;
    }

    function getSupportedLanguages() {
        return [...SUPPORTED_LANGS];
    }

    function getLanguageName(lang) {
        const names = { zh: '中文', en: 'English', ja: '日本語' };
        return names[lang] || lang;
    }

    // 初始化
    document.documentElement.lang = currentLang;

    return {
        t,
        setLanguage,
        getLanguage,
        getSupportedLanguages,
        getLanguageName,
        strings
    };
})();
