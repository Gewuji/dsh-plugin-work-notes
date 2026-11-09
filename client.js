/**
 * Work Notes — a freely arranged sticky-note board for the DSH web UI.
 *
 * Two registrations share one panel id:
 *  - `sidebar.panellist` (list, id `work-notes`): the sidebar row glyph. The
 *    sidebar owner renders the button and calls `ctx.layout.selectPanel(id)`.
 *  - `main` (keyed, key `work-notes`): the board in the centre column.
 *
 * Every note carries its own rectangle (x, y, width, height) and a status
 * (`todo` / `doing` / `done`), so cards move and resize independently. Notes
 * live in this browser's localStorage; the plugin appends no session events.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-work-notes',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace and panel id owned by this plugin. */
    const NS = 'work-notes'
    const PANEL_ID = 'work-notes'
    const STORAGE_KEY = 'dsh-work-notes.v1'

    /**
     * Card accents. The card surface is a tint of the host layer colour, so the
     * same accent stays readable under both the light and the dark theme.
     */
    const COLORS = [
      { id: 'amber', accent: '#e0a80d' },
      { id: 'sky', accent: '#3f83f8' },
      { id: 'mint', accent: '#17a673' },
      { id: 'rose', accent: '#d9538a' },
    ]
    const COLOR_IDS = COLORS.map((color) => color.id)

    /** Board geometry. Cards keep their own size; the constants only seed new ones. */
    const DEFAULT_WIDTH = 236
    const DEFAULT_HEIGHT = 150
    const MIN_WIDTH = 180
    const MIN_HEIGHT = 112
    const GAP = 12
    /** Width of one day column in the Gantt view. */
    const DAY_WIDTH = 26

    /** Distance in px within which a dragged card locks onto a neighbour's edge or centre. */
    const SNAP_THRESHOLD = 7
    const NO_GUIDES = { x: null, y: null }

    const STATUS_IDS = ['todo', 'doing', 'done']

    const zh = {
      'panel.title': '工作便签',
      'panel.subtitle': '随手记下要处理的事，拖动卡片随意摆放。',
      'panel.count': '共 {n} 条',
      'panel.doing': '进行中 {n}',
      'panel.done': '已完成 {n}',
      'composer.placeholder': '记点什么…例如「周五前整理周会纪要」',
      'composer.add': '添加便签',
      'composer.hint': 'Ctrl + Enter 快速添加',
      'empty.title': '还没有便签',
      'empty.body': '在上面写下第一件事，然后拖动卡片摆成自己的样子。',
      'status.label': '便签状态',
      'status.todo': '未完成',
      'status.doing': '进行中',
      'status.done': '完成',
      'note.pin': '置顶',
      'note.unpin': '取消置顶',
      'note.color': '换个颜色',
      'note.delete': '删除',
      'note.confirmDelete': '确认删除',
      'note.resize': '拖动调整大小 · 靠近其他卡片自动吸附',
      'storage.hint': '便签只保存在本机浏览器中，不会同步到其他设备。',
      'drag.hint': '拖动移动 · 右下角缩放 · 按住 Alt 临时关闭吸附',
      'view.notes': '便签',
      'view.calendar': '日历',
      'view.gantt': '甘特',
      'calendar.prev': '上个月',
      'calendar.next': '下个月',
      'calendar.today': '回到今天',
      'calendar.month': '{y} 年 {m} 月',
      'calendar.dayTitle': '{m} 月 {d} 日',
      'calendar.dayEmpty': '这天没有便签',
      'calendar.more': '还有 {n} 条',
      'calendar.dragHint': '把色块拖到其他日期即可改期 · 当天列表里的垃圾桶可直接删除',
      'weekday.mon': '星期一',
      'weekday.tue': '星期二',
      'weekday.wed': '星期三',
      'weekday.thu': '星期四',
      'weekday.fri': '星期五',
      'weekday.sat': '星期六',
      'weekday.sun': '星期日',
      'date.none': '未设日期',
      'date.set': '设置日期',
      'date.clear': '清除日期',
      'date.pickStart': '点一天作为开始',
      'date.pickEnd': '再点一天作为结束',
      'date.short': '{m}/{d}',
      'date.range': '{a} → {b}',
      'gantt.empty': '还没有带日期的便签',
      'gantt.unscheduled': '另有 {n} 张便签没有日期，去「便签」补上日期就会出现在这里',
      'gantt.dragHint': '拖动条块移动日期 · 拖两端改起止',
      'gantt.addPlaceholder': '新增事项，如「11月8日整理周报」，正文里的日期会被识别',
      'gantt.add': '添加',
      'infer.detected': '识别到 {range}',
      'infer.drop': '不带日期',
      'infer.dropTitle': '点击切换：是否采用自动识别到的日期',
      'calendar.addPlaceholder': '在 {range} 新增便签…',
      'calendar.add': '添加',
      'auto.hint': '有 {n} 张便签的正文里提到了日期',
      'auto.run': '一键识别日期',
      'month.pick': '选择年月',
      'calendar.monthShort': '{m} 月',
      'help.open': '使用说明',
      'help.title': '便签怎么用',
      'help.close': '关闭',
      'help.notes.title': '写便签',
      'help.notes.body': '输入框里写内容，按 Ctrl+Enter 就加上了。想挪位置就按住卡片拖，想改大小就拖右下角。',
      'help.date.title': '自动认出日期',
      'help.date.body': '正文里写「周五」「11月4日」「下周」「三天后」，会自动排到日历上。认错了就点输入框旁边那个日期小胶囊，可以取消掉。',
      'help.calendar.title': '日历',
      'help.calendar.body': '点某一天，下面会列出当天的便签，也能直接在下面加新的。把色块拖到别的日期就是改期。点顶上的「2026年11月」可以跳到任意年月。',
      'help.gantt.title': '甘特图',
      'help.gantt.body': '一个横条就是一件有日期的事。拖横条整体挪日期，拖横条两头改开始和结束。',
      'help.status.title': '状态和按钮',
      'help.status.body': '左上角选状态：未完成、进行中、完成。右上角三个小按钮：图钉置顶、水滴换色、垃圾桶删除。',
      'help.anno.title': '农历和节日',
      'help.anno.body': '每天下面会写农历日期，有节气和节日也会标出来。放假调休不跟国家通知走，只按日期算。',
      'time.justNow': '刚刚',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.yesterday': '昨天',
      'time.days': '{n} 天前',
      'time.date': '{m} 月 {d} 日',
    }

    const en = {
      'panel.title': 'Work Notes',
      'panel.subtitle': 'Jot down what to do and arrange the cards your way.',
      'panel.count': '{n} notes',
      'panel.doing': '{n} in progress',
      'panel.done': '{n} done',
      'composer.placeholder': 'Write something… e.g. "Summarize Friday standup"',
      'composer.add': 'Add note',
      'composer.hint': 'Ctrl + Enter to add',
      'empty.title': 'No notes yet',
      'empty.body': 'Write the first one above, then drag its card wherever you like.',
      'status.label': 'Note status',
      'status.todo': 'To do',
      'status.doing': 'In progress',
      'status.done': 'Done',
      'note.pin': 'Pin to top',
      'note.unpin': 'Unpin',
      'note.color': 'Change colour',
      'note.delete': 'Delete',
      'note.confirmDelete': 'Confirm delete',
      'note.resize': 'Drag to resize · snaps to nearby cards',
      'storage.hint': 'Notes stay in this browser; they are not synced elsewhere.',
      'drag.hint': 'Drag to move · corner to resize · hold Alt to disable snapping',
      'view.notes': 'Notes',
      'view.calendar': 'Calendar',
      'view.gantt': 'Gantt',
      'calendar.prev': 'Previous month',
      'calendar.next': 'Next month',
      'calendar.today': 'Back to today',
      'calendar.month': '{y}/{m}',
      'calendar.dayTitle': '{m}/{d}',
      'calendar.dayEmpty': 'Nothing on this day',
      'calendar.more': 'and {n} more',
      'calendar.dragHint': 'Drag a chip to another day to reschedule · the bin in the day list deletes',
      'weekday.mon': 'Monday',
      'weekday.tue': 'Tuesday',
      'weekday.wed': 'Wednesday',
      'weekday.thu': 'Thursday',
      'weekday.fri': 'Friday',
      'weekday.sat': 'Saturday',
      'weekday.sun': 'Sunday',
      'date.none': 'No date',
      'date.set': 'Set date',
      'date.clear': 'Clear date',
      'date.pickStart': 'Pick a start day',
      'date.pickEnd': 'Pick an end day',
      'date.short': '{m}/{d}',
      'date.range': '{a} → {b}',
      'gantt.empty': 'No dated notes yet',
      'gantt.unscheduled': '{n} notes have no date — add one in the Notes view to see them here',
      'gantt.dragHint': 'Drag a bar to shift dates · drag its ends to change the range',
      'gantt.addPlaceholder': 'New item, e.g. "Nov 8 write report" — dates in the text are detected',
      'gantt.add': 'Add',
      'infer.detected': 'Detected {range}',
      'infer.drop': 'No date',
      'infer.dropTitle': 'Toggle whether the detected date is used',
      'calendar.addPlaceholder': 'New note on {range}…',
      'calendar.add': 'Add',
      'auto.hint': '{n} notes mention a date in their text',
      'auto.run': 'Detect dates',
      'month.pick': 'Pick year and month',
      'calendar.monthShort': '{m}',
      'help.open': 'Guide',
      'help.title': 'How to use',
      'help.close': 'Close',
      'help.notes.title': 'Write a note',
      'help.notes.body': 'Type in the box, press Ctrl+Enter to add it. Drag a card to move it, drag its bottom-right corner to resize.',
      'help.date.title': 'Dates are detected',
      'help.date.body': 'Write a date in the text — "Friday", "Nov 4", "next week", "in 3 days" — and the note lands on the calendar by itself. Got it wrong? Click the date chip next to the input to drop it.',
      'help.calendar.title': 'Calendar',
      'help.calendar.body': 'Click a day to see its notes below, and add new ones right there. Drag a chip to another day to reschedule. Click the month title to jump to any month.',
      'help.gantt.title': 'Gantt',
      'help.gantt.body': 'One bar is one dated task. Drag a bar to move its dates; drag either end to change the start or finish.',
      'help.status.title': 'Status and buttons',
      'help.status.body': 'Pick a status on the left: To do, In progress, Done. Three buttons on the right: pin to top, change colour, delete.',
      'help.anno.title': 'Lunar and holidays',
      'help.anno.body': 'Each day shows its lunar date, plus solar terms and holidays when there are any. Official days off are not tracked.',
      'time.justNow': 'just now',
      'time.minutes': '{n} min ago',
      'time.hours': '{n} h ago',
      'time.yesterday': 'yesterday',
      'time.days': '{n} d ago',
      'time.date': '{m}/{d}',
    }

    const DICTIONARIES = { zh, en }

    const CSS = `
.wn-root { display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; background: radial-gradient(120% 70% at 50% -26%, color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent), transparent 62%), var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.wn-head { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 15px; }
.wn-head::after { content: ''; position: absolute; left: 24px; right: 24px; bottom: 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--dsw-alias-border-l1) 72%, transparent) 14%, color-mix(in srgb, var(--dsw-alias-border-l1) 72%, transparent) 86%, transparent); }
.wn-titleRow { display: flex; align-items: baseline; gap: 10px; }
.wn-title { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.014em; }
.wn-count { padding: 0 8px; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 90%, transparent); border-radius: 999px; font-size: 11.5px; line-height: 16px; color: color-mix(in srgb, var(--dsw-alias-label-secondary) 95%, transparent); background: color-mix(in srgb, var(--dsw-alias-label-primary) 3.5%, transparent); white-space: nowrap; }
.wn-count[data-tone="doing"] { color: var(--dsw-alias-brand-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.wn-count[data-tone="done"] { color: var(--dsw-alias-state-success-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 9%, transparent); }
.wn-sub { margin-top: 5px; font-size: 12px; letter-spacing: 0.005em; color: color-mix(in srgb, var(--dsw-alias-label-secondary) 88%, transparent); }
.wn-composerWrap { padding: 12px 24px 0; }
.wn-composer { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 8px; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 90%, transparent); border-radius: 13px; background: var(--dsw-alias-bg-layer-1); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent), 0 1px 2px color-mix(in srgb, #000 6%, transparent); }
.wn-composer:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l2)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent), 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent); }
.wn-composerInput { width: 100%; box-sizing: border-box; min-height: 44px; border: 0; outline: 0; padding: 0; resize: none; overflow: hidden; background: transparent; color: inherit; font: inherit; font-size: 14px; line-height: 1.55; }
.wn-composerInput::placeholder, .wn-noteInput::placeholder { color: var(--dsw-alias-label-secondary); opacity: 0.75; }
.wn-composerBar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; row-gap: 6px; }
.wn-dots { display: flex; gap: 6px; margin-right: auto; }
.wn-dot { width: 16px; height: 16px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: var(--wn-accent, var(--dsw-alias-brand-primary)); opacity: 0.55; transition: opacity 0.12s ease, transform 0.12s ease; }
.wn-dot:hover { opacity: 0.85; }
.wn-dot[data-active="true"] { opacity: 1; transform: scale(1.12); box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1), 0 0 0 3px var(--wn-accent); }
.wn-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.wn-addBtn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.wn-addBtn:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }
.wn-addBtn:disabled { cursor: default; color: var(--dsw-alias-label-secondary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.wn-scroll { flex: 1; min-height: 0; overflow: auto; padding: 16px 24px 24px; }
.wn-canvas { position: relative; min-height: 100%; min-width: 100%; }
.wn-guide { position: absolute; z-index: 8; pointer-events: none; background: var(--dsw-alias-brand-primary); opacity: 0.45; }
.wn-guideX { top: 0; bottom: 0; width: 1px; }
.wn-guideY { left: 0; right: 0; height: 1px; }
.wn-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 24px; padding: 44px 20px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 14px; color: var(--dsw-alias-label-secondary); text-align: center; }
.wn-emptyTitle { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.wn-emptyBody { max-width: 340px; font-size: 12px; line-height: 1.6; }
.wn-foot { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 24px 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wn-foot::before { content: ''; position: absolute; left: 24px; right: 24px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--dsw-alias-border-l1) 72%, transparent) 14%, color-mix(in srgb, var(--dsw-alias-border-l1) 72%, transparent) 86%, transparent); }
.wn-note { position: absolute; z-index: 1; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box; padding: 6px 8px 5px 10px; border: 1px solid color-mix(in srgb, var(--wn-accent) 26%, var(--dsw-alias-border-l1)); border-radius: 12px; background: color-mix(in srgb, var(--wn-accent) 10%, var(--dsw-alias-bg-layer-1)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent), 0 1px 2px color-mix(in srgb, #000 8%, transparent), 0 10px 22px -18px color-mix(in srgb, #000 60%, transparent); transition: border-color 0.12s ease, box-shadow 0.14s ease, transform 0.14s ease; }
.wn-note::before { content: ''; position: absolute; left: -1px; top: 12px; bottom: 12px; width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--wn-accent) 82%, transparent); }
.wn-note:hover:not([data-active="true"]) { border-color: color-mix(in srgb, var(--wn-accent) 46%, var(--dsw-alias-border-l2)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent), 0 2px 5px color-mix(in srgb, #000 9%, transparent), 0 16px 30px -18px color-mix(in srgb, #000 55%, transparent); transform: translateY(-1px); }
.wn-note[data-pinned="true"] { border-color: color-mix(in srgb, var(--wn-accent) 62%, var(--dsw-alias-border-l2)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent), 0 0 0 1px color-mix(in srgb, var(--wn-accent) 30%, transparent), 0 10px 22px -18px color-mix(in srgb, #000 60%, transparent); }
.wn-note[data-active="true"] { z-index: 4; border-color: var(--dsw-alias-brand-primary); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent), 0 12px 28px -12px color-mix(in srgb, #000 55%, transparent), 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent); }
.wn-note[data-menu="true"] { z-index: 6; }
.wn-note[data-focus="true"] { border-color: var(--dsw-alias-brand-primary); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent), 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, transparent); }
.wn-note[data-status="done"] { background: color-mix(in srgb, var(--wn-accent) 4%, var(--dsw-alias-bg-layer-1)); border-color: color-mix(in srgb, var(--wn-accent) 16%, var(--dsw-alias-border-l1)); }
.wn-note[data-status="done"]::before { opacity: 0.4; }
.wn-noteHead { display: flex; align-items: center; gap: 4px; flex: none; height: 22px; }
.wn-grip { flex: 1; align-self: stretch; min-width: 8px; cursor: grab; }
.wn-grip::after { content: ''; display: block; width: 14px; height: 2px; margin: 10px auto 0; border-radius: 1px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 45%, transparent); }
.wn-note[data-active="true"] .wn-grip { cursor: grabbing; }
.wn-status { display: inline-flex; align-items: center; gap: 6px; flex: none; height: 22px; padding: 0 5px 0 6px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; font: inherit; font-size: 11.5px; line-height: 20px; white-space: nowrap; background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-secondary); }
.wn-status:hover { border-color: var(--dsw-alias-border-l2); }
.wn-status[data-open="true"] { border-color: var(--dsw-alias-brand-primary); }
.wn-status[data-status="doing"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); color: var(--dsw-alias-brand-primary); }
.wn-status[data-status="done"] { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 15%, transparent); color: var(--dsw-alias-state-success-primary); }
.wn-statusDot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.wn-statusChevron { flex: none; opacity: 0.7; }
.wn-menu { position: absolute; top: 30px; left: 8px; z-index: 30; display: flex; flex-direction: column; gap: 1px; min-width: 116px; padding: 4px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 8px 24px color-mix(in srgb, #000 22%, transparent); }
.wn-menuItem { display: flex; align-items: center; gap: 7px; padding: 5px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; text-align: left; white-space: nowrap; cursor: pointer; }
.wn-menuItem:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); }
.wn-menuItem[data-current="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); color: var(--dsw-alias-brand-primary); }
.wn-menuDot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-label-secondary); }
.wn-menuDot[data-status="doing"] { background: var(--dsw-alias-brand-primary); }
.wn-menuDot[data-status="done"] { background: var(--dsw-alias-state-success-primary); }
.wn-noteInput { flex: 1; min-height: 0; width: 100%; box-sizing: border-box; border: 0; outline: 0; padding: 0; resize: none; overflow: auto; background: transparent; color: inherit; font: inherit; font-size: 14px; line-height: 1.55; }
.wn-noteText { flex: 1; min-height: 0; margin: 0; padding: 0; overflow: auto; font-size: 14px; line-height: 1.55; color: var(--dsw-alias-label-secondary); text-decoration: line-through; text-decoration-thickness: 1px; text-decoration-color: color-mix(in srgb, var(--dsw-alias-label-secondary) 50%, transparent); white-space: pre-wrap; word-break: break-word; }
.wn-noteFoot { display: flex; align-items: center; gap: 6px; flex: none; height: 14px; padding-right: 14px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.wn-noteMeta { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wn-iconBtn { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 6px; cursor: pointer; background: transparent; color: var(--dsw-alias-label-secondary); }
.wn-iconBtn:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.wn-iconBtn[data-on="true"] { color: var(--dsw-alias-brand-primary); }
.wn-iconBtn[data-danger="true"] { width: auto; padding: 0 6px; font-size: 11px; color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent); }
.wn-resize { position: absolute; right: 1px; bottom: 1px; width: 16px; height: 16px; color: var(--dsw-alias-label-secondary); cursor: nwse-resize; opacity: 0.5; }
.wn-resize:hover { opacity: 1; }
.wn-resize::before, .wn-resize::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; border-bottom-right-radius: 2px; }
.wn-resize::after { right: 7px; bottom: 7px; width: 2px; height: 2px; border: 0; background: currentColor; border-radius: 1px; }
/* view tabs */
.wn-tabs { display: flex; flex: none; gap: 2px; padding: 2px; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 70%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent); }
.wn-tab { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.wn-tab:hover { color: var(--dsw-alias-label-primary); }
.wn-tab[data-active="true"] { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent), 0 1px 2px color-mix(in srgb, #000 16%, transparent), 0 0 0 1px color-mix(in srgb, var(--dsw-alias-border-l1) 85%, transparent); }

/* date chip and the date-range popover */
.wn-dateChip { display: inline-flex; align-items: center; gap: 4px; max-width: 62%; min-width: 0; height: 17px; padding: 0 5px; border: 1px solid transparent; border-radius: 5px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 10.5px; line-height: 15px; cursor: pointer; overflow: hidden; }
.wn-dateChip:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.wn-dateChip[data-open="true"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.wn-dateChip[data-empty="true"] { border-color: var(--dsw-alias-border-l1); border-style: dashed; background: transparent; }
.wn-dateChip > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wn-picker { position: fixed; z-index: 60; width: 232px; padding: 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 10px 28px color-mix(in srgb, #000 24%, transparent); }
.wn-pickerHead { display: flex; align-items: center; gap: 3px; margin-bottom: 6px; }
.wn-pickerTitle { flex: 1; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.wn-pickerGrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.wn-pickerWeekday { padding-bottom: 2px; text-align: center; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.wn-pickerDay { height: 24px; border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; cursor: pointer; }
.wn-pickerDay:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.wn-pickerDay[data-outside="true"] { opacity: 0.55; color: var(--dsw-alias-label-secondary); }
.wn-pickerDay[data-in-range="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent); color: var(--dsw-alias-brand-primary); }
.wn-pickerDay[data-today="true"] { box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.wn-pickerFoot { display: flex; align-items: center; gap: 6px; margin-top: 7px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-border-l1); }
.wn-pickerHint { flex: 1; min-width: 0; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.wn-pickerAction { height: 20px; padding: 0 6px; border: 0; border-radius: 5px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); color: var(--dsw-alias-label-primary); font: inherit; font-size: 10.5px; cursor: pointer; white-space: nowrap; }
.wn-pickerAction:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent); }
.wn-navBtn { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.wn-navBtn:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.wn-navText { height: 24px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; cursor: pointer; white-space: nowrap; }
.wn-navText:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }

/* calendar view */
.wn-viewHead { display: flex; align-items: center; gap: 6px; padding-bottom: 10px; }
.wn-monthLabel { margin-right: auto; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.wn-weekRow, .wn-monthGrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.wn-weekRow { margin-bottom: 5px; }
.wn-weekCell { padding: 4px 0 5px; text-align: center; font-size: 10px; letter-spacing: 0.06em; color: color-mix(in srgb, var(--dsw-alias-label-secondary) 90%, transparent); white-space: nowrap; }
.wn-dayCell { display: flex; flex-direction: column; gap: 1px; min-height: 96px; padding: 5px 6px; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 88%, transparent); border-radius: 9px; background: var(--dsw-alias-bg-layer-1); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent); cursor: pointer; overflow: hidden; }
/* Zebra columns: every other weekday sits one shade off, so a column reads as one band down the month. */
.wn-dayCell[data-stripe="true"] { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, var(--dsw-alias-bg-layer-1)); }
.wn-weekCell[data-stripe="true"] { border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
.wn-dayCell[data-outside="true"] { opacity: 0.45; }
.wn-dayCell:hover { border-color: var(--dsw-alias-border-l2); }
.wn-dayCell[data-today="true"] { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 62%, var(--dsw-alias-border-l1)); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent), 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.wn-dayCell[data-selected="true"] { box-shadow: inset 0 0 0 1.5px var(--dsw-alias-brand-primary), inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent); }
.wn-dayCell[data-today="true"][data-selected="true"] { box-shadow: inset 0 0 0 1.5px var(--dsw-alias-brand-primary), 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.wn-dayCell[data-drop="true"] { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, var(--dsw-alias-bg-layer-1)); }
.wn-dayNum { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.wn-dayCell[data-today="true"] .wn-dayNum { color: var(--dsw-alias-brand-primary); font-weight: 600; }
.wn-chip { display: flex; align-items: center; min-width: 0; padding: 0 4px; border-left: 2px solid var(--wn-status-color, var(--dsw-alias-brand-primary)); border-radius: 5px; background: color-mix(in srgb, var(--wn-status-color, var(--dsw-alias-brand-primary)) 16%, transparent); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent); color: var(--dsw-alias-label-primary); font-size: 10px; line-height: 15px; cursor: grab; }
.wn-chip[data-dragging="true"] { opacity: 0.45; }
.wn-chipText { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wn-chipMore { font-size: 9.5px; color: var(--dsw-alias-label-secondary); }
.wn-dayList { position: relative; margin-top: 14px; padding-top: 12px; }
.wn-dayList::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--dsw-alias-border-l1) 85%, transparent) 10%, color-mix(in srgb, var(--dsw-alias-border-l1) 85%, transparent) 90%, transparent); }
.wn-dayListTitle { margin-bottom: 4px; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.wn-dayItem { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; cursor: pointer; }
.wn-dayItem:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.wn-dayItemText { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--dsw-alias-label-primary); }
.wn-dayItemRange { flex: none; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.wn-statusDotSmall { flex: none; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.wn-emptyMini { padding: 28px 8px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.wn-hintLine { padding: 10px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary); }

/* gantt view */
.wn-scrollGantt { padding: 0; overflow: auto; overscroll-behavior: contain; }
.wn-ganttPane { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 0 24px 16px; box-sizing: border-box; }
.wn-ganttComposer { display: flex; align-items: center; gap: 6px; flex: none; margin: 12px 0 8px; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.wn-ganttComposer:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l2)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent); }
.wn-gantt { display: flex; flex-direction: column; width: 100%; min-height: 100%; }
.wn-ganttHead { position: sticky; top: 0; z-index: 3; display: flex; background: var(--dsw-alias-bg-base); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wn-ganttLeft { position: sticky; left: 0; z-index: 2; flex: none; width: 216px; box-sizing: border-box; padding: 4px 8px; background: var(--dsw-alias-bg-base); border-right: 1px solid var(--dsw-alias-border-l1); }
.wn-ganttHead .wn-ganttLeft { z-index: 4; }
.wn-ganttHeadRight { flex: 1; min-width: 0; overflow: hidden; }
.wn-ganttTrack { position: relative; flex: none; }
.wn-ganttMonths { display: flex; width: max-content; border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 60%, transparent); }
.wn-ganttMonthSeg { flex: none; box-sizing: border-box; padding: 1px 4px; overflow: hidden; font-size: 10px; color: var(--dsw-alias-label-secondary); box-shadow: inset 1px 0 0 color-mix(in srgb, var(--dsw-alias-border-l1) 60%, transparent); white-space: nowrap; }
.wn-ganttCells { display: flex; width: max-content; }
.wn-ganttCell { flex: none; box-sizing: border-box; padding: 1px 0; text-align: center; font-size: 9.5px; color: var(--dsw-alias-label-secondary); box-shadow: inset 1px 0 0 color-mix(in srgb, var(--dsw-alias-border-l1) 45%, transparent); }
.wn-ganttCell[data-weekend="true"] { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
.wn-ganttCell[data-today="true"] { color: var(--dsw-alias-brand-primary); font-weight: 600; }
.wn-ganttRow { display: flex; border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent); }
.wn-ganttRow .wn-ganttLeft { display: flex; align-items: center; gap: 6px; min-height: 34px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.wn-ganttLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.wn-ganttLabel:hover { color: var(--dsw-alias-brand-primary); }
.wn-ganttRow .wn-iconBtn { opacity: 0; flex: none; }
.wn-ganttRow:hover .wn-iconBtn, .wn-ganttRow .wn-iconBtn[data-danger="true"] { opacity: 1; }
.wn-ganttTrack { position: relative; flex: 1; min-width: 0; }
.wn-ganttTrack { position: relative; flex: none; }
.wn-ganttBar { position: absolute; top: 5px; display: flex; align-items: center; box-sizing: border-box; height: 24px; padding: 0 6px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--wn-status-color, var(--dsw-alias-brand-primary)) 42%, transparent); border-radius: 7px; background: linear-gradient(180deg, color-mix(in srgb, var(--wn-status-color, var(--dsw-alias-brand-primary)) 30%, var(--dsw-alias-bg-base)), color-mix(in srgb, var(--wn-status-color, var(--dsw-alias-brand-primary)) 17%, var(--dsw-alias-bg-base))); box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent), 0 1px 2px color-mix(in srgb, #000 10%, transparent); color: var(--dsw-alias-label-primary); font-size: 10.5px; white-space: nowrap; cursor: grab; }
.wn-ganttBar[data-active="true"] { border-color: var(--dsw-alias-brand-primary); cursor: grabbing; }
.wn-ganttHandle { position: absolute; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
.wn-ganttHandle[data-side="start"] { left: 0; }
.wn-ganttHandle[data-side="end"] { right: 0; }
.wn-ganttToday { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--dsw-alias-brand-primary); box-shadow: 0 0 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); opacity: 0.62; pointer-events: none; }

.wn-inferChip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 42%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); color: var(--dsw-alias-brand-primary); font: inherit; font-size: 10.5px; line-height: 18px; white-space: nowrap; cursor: pointer; }
.wn-inferChip:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent); }
.wn-inferChip[data-ignored="true"] { border-color: var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-secondary); }
.wn-dayComposer { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.wn-dayComposer:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l2)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent); }
.wn-dayInput { flex: 1; min-width: 0; height: 22px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 12.5px; }
.wn-dayInput::placeholder { color: var(--dsw-alias-label-secondary); opacity: 0.8; }
.wn-dayAdd { flex: none; height: 22px; padding: 0 9px; border: 0; border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); color: var(--dsw-alias-brand-primary); font: inherit; font-size: 11.5px; cursor: pointer; }
.wn-dayAdd:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }
.wn-dayAdd:disabled { cursor: default; color: var(--dsw-alias-label-secondary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }

.wn-autoBar { display: flex; align-items: center; gap: 10px; margin: 8px 24px 0; padding: 6px 10px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.wn-autoBar > button { margin-left: auto; }

.wn-headActions { display: flex; align-items: center; gap: 8px; flex: none; }
.wn-helpBtn { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; white-space: nowrap; cursor: pointer; }
.wn-helpBtn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.wn-monthLabel { display: inline-flex; align-items: center; gap: 5px; margin-right: auto; padding: 3px 8px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.wn-monthLabel:hover { border-color: var(--dsw-alias-border-l2); }
.wn-monthPicker { position: fixed; z-index: 62; width: 216px; padding: 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 10px 28px color-mix(in srgb, #000 24%, transparent); }
.wn-monthGridPicker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.wn-monthCell { height: 30px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.wn-monthCell:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.wn-monthCell[data-active="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); color: var(--dsw-alias-brand-primary); font-weight: 600; }
.wn-dayNote { flex: none; margin: -1px 0 0; overflow: hidden; font-size: 9px; line-height: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; text-overflow: ellipsis; }
.wn-dayNote[data-kind="lunar"] { opacity: 0.85; }
.wn-dayNote[data-kind="festival"] { color: var(--dsw-alias-state-error-primary); font-weight: 500; }
.wn-dayNote[data-kind="term"] { color: var(--dsw-alias-brand-primary); }
.wn-helpOverlay { position: absolute; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 24px; background: color-mix(in srgb, #000 34%, transparent); }
.wn-help { display: flex; flex-direction: column; width: min(560px, 100%); max-height: 100%; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px; background: var(--dsw-alias-bg-overlay); box-shadow: 0 18px 48px color-mix(in srgb, #000 32%, transparent); }
.wn-helpHead { display: flex; align-items: center; gap: 10px; padding: 13px 16px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.wn-helpTitle { flex: 1; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.wn-helpBody { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px 18px; }
.wn-helpSection { margin-bottom: 12px; }
.wn-helpSection h3 { margin: 0 0 4px; font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-brand-primary); }
.wn-helpSection p { margin: 0; font-size: 12px; line-height: 1.75; color: var(--dsw-alias-label-primary); }
.wn-root { position: relative; }

.wn-dayItem .wn-iconBtn { opacity: 0; }
.wn-dayItem:hover .wn-iconBtn, .wn-dayItem .wn-iconBtn[data-danger="true"] { opacity: 1; }
.wn-dayItem .wn-iconBtn[data-danger="true"] { flex: none; margin-left: 2px; }

/* Alternating day stripes across the whole Gantt timeline (and its header cells). */
.wn-ganttTrack { background-image: repeating-linear-gradient(to right, color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent) 0, color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent) var(--wn-day-width, 26px), transparent var(--wn-day-width, 26px), transparent calc(var(--wn-day-width, 26px) * 2)); }
.wn-ganttCell[data-odd="true"] { background: color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent); }

/* Floating surfaces share one elevation stack: a contact shadow plus a wide cast. */
.wn-picker, .wn-monthPicker, .wn-menu, .wn-help { box-shadow: 0 2px 6px color-mix(in srgb, #000 12%, transparent), 0 26px 50px -24px color-mix(in srgb, #000 46%, transparent); }

/* Numbers keep their column instead of shifting the layout as they tick. */
.wn-count, .wn-dayNum, .wn-dayNote, .wn-dayItemRange, .wn-noteMeta, .wn-ganttCell, .wn-ganttMonthSeg { font-variant-numeric: tabular-nums; }

/* Keyboard focus on a transparent control was invisible; one brand ring for all of them. */
.wn-root :is(button, input, textarea):focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .wn-dot, .wn-note { transition: none; }
}
`

    /** Fallback dictionary key when the locale service has no entry. */
    function makeTranslate(locale) {
      const bound = locale.bind(NS)
      return (key) => {
        let value = key
        try {
          value = bound(key)
        } catch (error) {
          value = key
        }
        if (value !== key) return value
        return DICTIONARIES.zh[key] || key
      }
    }

    function fill(template, values) {
      let text = template
      for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, String(value))
      return text
    }

    /** Short relative timestamp; the board re-renders every 30s so it stays fresh. */
    function formatTime(timestamp, t) {
      const elapsed = Date.now() - timestamp
      if (elapsed < 60_000) return t('time.justNow')
      if (elapsed < 3_600_000) return fill(t('time.minutes'), { n: Math.floor(elapsed / 60_000) })
      if (elapsed < 86_400_000) return fill(t('time.hours'), { n: Math.floor(elapsed / 3_600_000) })
      if (elapsed < 172_800_000) return t('time.yesterday')
      if (elapsed < 7 * 86_400_000) return fill(t('time.days'), { n: Math.floor(elapsed / 86_400_000) })
      const date = new Date(timestamp)
      return fill(t('time.date'), { m: date.getMonth() + 1, d: date.getDate() })
    }

    /*
     * Dates are stored as 'YYYY-MM-DD' text and compared as integer day indices
     * (UTC midnight / DAY_MS), so arithmetic never drifts across DST or zones.
     */
    const DAY_MS = 86_400_000
    const VIEW_KEY = 'dsh-work-notes.view'
    const WEEKDAYS = ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun']
    const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function isDateText(value) {
      return typeof value === 'string' && DATE_TEXT.test(value)
    }

    function dayOf(date) {
      const parts = date.split('-')
      return Math.floor(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / DAY_MS)
    }

    function dateOf(day) {
      return new Date(day * DAY_MS).toISOString().slice(0, 10)
    }

    function todayDay() {
      const now = new Date()
      return dayOf(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`)
    }

    function monthOfDay(day) {
      const date = new Date(day * DAY_MS)
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
    }

    function shiftMonth(month, delta) {
      const index = month.year * 12 + month.month + delta
      return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
    }

    /** Monday-first weekday index for a day index (1970-01-01 was a Thursday). */
    function weekdayOf(day) {
      return (((day + 3) % 7) + 7) % 7
    }

    /** Six weeks of day indices covering the month, Monday first. */
    function monthCells(month) {
      const first = dayOf(`${month.year}-${pad2(month.month + 1)}-01`)
      const start = first - weekdayOf(first)
      const cells = []
      for (let index = 0; index < 42; index += 1) cells.push(start + index)
      return cells
    }

    function dayNumber(day) {
      return new Date(day * DAY_MS).getUTCDate()
    }

    function shortDate(day, t) {
      const date = new Date(day * DAY_MS)
      return fill(t('date.short'), { m: date.getUTCMonth() + 1, d: date.getUTCDate() })
    }

    /** Scheduled span of a note in day indices; null when it has no start date. */
    function dayRange(note) {
      if (!note.startDate) return null
      const start = dayOf(note.startDate)
      const end = note.endDate ? dayOf(note.endDate) : start
      return { start, end: Math.max(start, end) }
    }

    function rangeLabel(note, t) {
      if (!note.startDate) return t('date.none')
      const start = dayOf(note.startDate)
      const end = note.endDate ? Math.max(start, dayOf(note.endDate)) : start
      if (end === start) return shortDate(start, t)
      return fill(t('date.range'), { a: shortDate(start, t), b: shortDate(end, t) })
    }

    function statusColor(status) {
      if (status === 'doing') return 'var(--dsw-alias-brand-primary)'
      if (status === 'done') return 'var(--dsw-alias-state-success-primary)'
      return 'var(--dsw-alias-label-secondary)'
    }

    /*
     * Draft inference: read the dates a note's own text already talks about
     * ("周五前整理纪要", "11月4日到11月8日走查", "下周一评审") so the note lands on
     * the calendar/Gantt without a second editing step. Local and instant.
     */
    const CN_NUMERALS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const WEEKDAY_CHARS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 }
    const NUM_TEXT = '([0-9]{1,2}|[一二三四五六七八九十]{1,3})'
    const DATE_TEXT_PART = `(?:([0-9]{4})[-/年])?${NUM_TEXT}[-/月]${NUM_TEXT}日?`
    const CONNECT_TEXT = '\\s*(?:到|至|~|—|–|-|to)\\s*'
    const RANGE_PATTERN = new RegExp(`${DATE_TEXT_PART}${CONNECT_TEXT}${DATE_TEXT_PART}`)
    const SAME_MONTH_PATTERN = new RegExp(
      `(?:([0-9]{4})[-/年])?${NUM_TEXT}[-/月]${NUM_TEXT}日?${CONNECT_TEXT}${NUM_TEXT}日?`,
    )
    const SINGLE_PATTERN = new RegExp(DATE_TEXT_PART)

    /** '11', '十一', '二十三' → number; NaN when not numeric. */
    function numberFrom(text) {
      if (text === undefined || text === null) return Number.NaN
      if (/^[0-9]+$/.test(text)) return Number(text)
      let total = 0
      let digit = 0
      let seen = false
      for (const character of text) {
        if (character === '十') {
          total += (digit === 0 ? 1 : digit) * 10
          digit = 0
          seen = true
          continue
        }
        const value = CN_NUMERALS[character]
        if (value === undefined) return Number.NaN
        digit = value
        seen = true
      }
      return seen ? total + digit : Number.NaN
    }

    function buildDay(year, month, date) {
      if (!Number.isFinite(month) || !Number.isFinite(date)) return null
      if (month < 1 || month > 12 || date < 1 || date > 31) return null
      return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS)
    }

    /** Resolve a month/day pair; a bare month/day already well past rolls to next year. */
    function resolveDay(yearText, monthText, dateText, baseDay) {
      const month = numberFrom(monthText)
      const date = numberFrom(dateText)
      if (!Number.isFinite(month) || !Number.isFinite(date)) return null
      const baseYear = monthOfDay(baseDay).year
      const year = yearText === undefined || yearText === null ? baseYear : numberFrom(yearText)
      if (!Number.isFinite(year)) return null
      let day = buildDay(year, month, date)
      if (day === null) return null
      if ((yearText === undefined || yearText === null) && day < baseDay - 30) {
        const rolled = buildDay(year + 1, month, date)
        if (rolled !== null) day = rolled
      }
      return day
    }

    function orderRange(start, end) {
      return start <= end ? { start, end: start === end ? null : end } : { start: end, end: start === end ? null : start }
    }

    /** '持续3天' extends a single start into a span. */
    function withSpan(start, text) {
      const span = text.match(/(?:持续|共计|共|需要)\s*([0-9]{1,2}|[一二三四五六七八九十]{1,2})\s*天/)
      if (span !== null) {
        const count = numberFrom(span[1])
        if (Number.isFinite(count) && count > 1) return { start, end: start + count - 1 }
      }
      return { start, end: null }
    }

    function lastDayOfMonth(year, month) {
      return dayOf(`${year}-${pad2(month + 1)}-${pad2(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`)
    }

    /*
     * Chinese calendar annotations: the lunar date comes from ICU's native
     * `chinese` calendar, solar terms from the standard 1901-2100 formula, and
     * holidays are the fixed-date plus lunar ones that never move.
     */
    const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
    const LUNAR_DAY_NAMES = [
      '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
      '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
    ]
    const SOLAR_TERM_NAMES = [
      '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
      '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
      '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
    ]
    const SOLAR_TERM_OFFSETS = [
      0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
      263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
    ]
    const LUNAR_FESTIVALS = {
      '1/1': '春节',
      '1/15': '元宵节',
      '5/5': '端午节',
      '7/7': '七夕节',
      '8/15': '中秋节',
      '9/9': '重阳节',
      '12/8': '腊八节',
    }
    const FIXED_HOLIDAYS = {
      '1/1': '元旦',
      '3/8': '妇女节',
      '5/1': '劳动节',
      '5/4': '青年节',
      '6/1': '儿童节',
      '7/1': '建党节',
      '8/1': '建军节',
      '9/10': '教师节',
    }
    const lunarFormatter =
      typeof Intl === 'object' && typeof Intl.DateTimeFormat === 'function'
        ? new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', month: 'numeric', day: 'numeric' })
        : null
    const lunarCache = new Map()
    const solarTermCache = new Map()

    /** Lunar month/day for a day index, or null when the runtime lacks the calendar. */
    function lunarOf(day) {
      if (lunarFormatter === null) return null
      const cached = lunarCache.get(day)
      if (cached !== undefined) return cached
      let value = null
      try {
        const parts = lunarFormatter.formatToParts(new Date(day * DAY_MS + 12 * 3_600_000))
        const fields = {}
        for (const part of parts) fields[part.type] = part.value
        const month = Number(fields.month)
        const date = Number(fields.day)
        if (Number.isFinite(month) && Number.isFinite(date) && month >= 1 && month <= 12) {
          value = {
            month,
            day: date,
            label: `${LUNAR_MONTH_NAMES[month - 1]}月${LUNAR_DAY_NAMES[date - 1] || ''}`,
          }
        }
      } catch (error) {
        value = null
      }
      lunarCache.set(day, value)
      return value
    }

    function solarTermsOfYear(year) {
      const cached = solarTermCache.get(year)
      if (cached !== undefined) return cached
      const terms = new Map()
      if (year >= 1901 && year <= 2100) {
        for (let index = 0; index < 24; index += 1) {
          const termDay = new Date(
            31556925974.7 * (year - 1900) + SOLAR_TERM_OFFSETS[index] * 60000 + Date.UTC(1900, 0, 6, 2, 5),
          ).getUTCDate()
          const day = buildDay(year, (index >> 1) + 1, termDay)
          if (day !== null) terms.set(day, SOLAR_TERM_NAMES[index])
        }
      }
      solarTermCache.set(year, terms)
      return terms
    }

    function solarTermOf(day) {
      const value = solarTermsOfYear(monthOfDay(day).year).get(day)
      return value === undefined ? null : value
    }

    /** Both annotations a calendar cell carries: the lunar date and any holiday/term. */
    function annotateDay(day) {
      const month = monthOfDay(day)
      const date = dayNumber(day)
      const lunar = lunarOf(day)
      const term = solarTermOf(day)
      let event = null
      if (lunar !== null && lunar.month === 12 && lunar.day >= 29) {
        const next = lunarOf(day + 1)
        if (next !== null && next.month === 1 && next.day === 1) event = { text: '除夕', kind: 'festival' }
      }
      if (event === null && term === '清明') event = { text: '清明', kind: 'festival' }
      if (event === null) {
        const fixed = FIXED_HOLIDAYS[`${month.month + 1}/${date}`]
        if (fixed !== undefined) event = { text: fixed, kind: 'festival' }
      }
      if (event === null && month.month === 9 && date <= 3) event = { text: '国庆节', kind: 'festival' }
      if (event === null && lunar !== null) {
        const festival = LUNAR_FESTIVALS[`${lunar.month}/${lunar.day}`]
        if (festival !== undefined) event = { text: festival, kind: 'festival' }
      }
      if (event === null && term !== null) event = { text: term, kind: 'term' }
      return { lunar: lunar === null ? null : lunar.label, event }
    }


    function describeRange(dates, t) {
      if (dates === null) return ''
      if (dates.end === null || dates.end === dates.start) return shortDate(dates.start, t)
      return fill(t('date.range'), { a: shortDate(dates.start, t), b: shortDate(dates.end, t) })
    }

    /** Best-effort calendar dates from a note draft; null when nothing date-like appears. */
    function inferDates(rawText, baseDay) {
      const text = rawText
        .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
        .replace(/号/g, '日')
        .replace(/[，,、]/g, ' ')

      const two = text.match(RANGE_PATTERN)
      if (two !== null) {
        const start = resolveDay(two[1], two[2], two[3], baseDay)
        const end = resolveDay(two[4], two[5], two[6], baseDay)
        if (start !== null && end !== null) return orderRange(start, end)
      }

      const sameMonth = text.match(SAME_MONTH_PATTERN)
      if (sameMonth !== null) {
        const start = resolveDay(sameMonth[1], sameMonth[2], sameMonth[3], baseDay)
        if (start !== null) {
          let end = resolveDay(sameMonth[1], sameMonth[2], sameMonth[4], baseDay)
          if (end !== null && end < start) {
            /* "12月28日到3日" crosses into the next month. */
            const month = numberFrom(sameMonth[2])
            const year = monthOfDay(start).year
            end = buildDay(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, numberFrom(sameMonth[4]))
          }
          if (end !== null) return orderRange(start, end)
        }
      }

      const single = text.match(SINGLE_PATTERN)
      if (single !== null) {
        const day = resolveDay(single[1], single[2], single[3], baseDay)
        if (day !== null) return withSpan(day, text)
      }

      const relatives = [
        ['大后天', 3],
        ['后天', 2],
        ['明天', 1],
        ['明日', 1],
        ['明早', 1],
        ['明晚', 1],
        ['今天', 0],
        ['今日', 0],
        ['今晚', 0],
        ['今早', 0],
        ['昨天', -1],
      ]
      for (const [word, offset] of relatives) {
        if (text.includes(word)) return { start: baseDay + offset, end: null }
      }
      const daysLater = text.match(/(?:([0-9]{1,3}|[一二三四五六七八九十]{1,3})\s*天\s*(?:以)?后)/)
      if (daysLater !== null) {
        const count = numberFrom(daysLater[1])
        if (Number.isFinite(count)) return { start: baseDay + count, end: null }
      }

      const monday = baseDay - weekdayOf(baseDay)
      const weekday = text.match(
        /(下下周|下周|下个星期|下星期|本周|这周|这个星期|这星期|上个星期|上周)?\s*(?:星期|礼拜|周)([一二三四五六日天1-7])/,
      )
      if (weekday !== null) {
        const target = WEEKDAY_CHARS[weekday[2]]
        const prefix = weekday[1] || ''
        if (target !== undefined) {
          let day
          if (prefix === '下下周') day = monday + 14 + (target - 1)
          else if (/^下/.test(prefix)) day = monday + 7 + (target - 1)
          else if (/^(本周|这周)/.test(prefix)) day = monday + (target - 1)
          else day = baseDay + ((target - 1 - weekdayOf(baseDay) + 7) % 7)
          return withSpan(day, text)
        }
      }

      if (/(下下周)/.test(text)) return { start: monday + 14, end: monday + 20 }
      if (/(下周|下个星期|下星期)/.test(text)) return { start: monday + 7, end: monday + 13 }
      if (/(本周|这周|这个星期|这星期)/.test(text)) return { start: monday, end: monday + 6 }

      const month = monthOfDay(baseDay)
      if (/(下个月|下月)/.test(text)) {
        const next = shiftMonth(month, 1)
        return {
          start: dayOf(`${next.year}-${pad2(next.month + 1)}-01`),
          end: lastDayOfMonth(next.year, next.month),
        }
      }
      if (/(这个月|本月|当月)/.test(text)) {
        return {
          start: dayOf(`${month.year}-${pad2(month.month + 1)}-01`),
          end: lastDayOfMonth(month.year, month.month),
        }
      }
      if (/(月底|月末)/.test(text)) return { start: lastDayOfMonth(month.year, month.month), end: null }

      return null
    }


    function readStoredView() {
      try {
        const raw = window.localStorage.getItem(VIEW_KEY)
        return raw === 'calendar' || raw === 'gantt' ? raw : 'notes'
      } catch (error) {
        return 'notes'
      }
    }

    function writeStoredView(view) {
      try {
        window.localStorage.setItem(VIEW_KEY, view)
      } catch (error) {
        /* Non-persistent views are harmless. */
      }
    }

    function isNote(value) {
      return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.text === 'string'
      )
    }

    function normalizeNote(value) {
      const now = Date.now()
      const status = STATUS_IDS.includes(value.status) ? value.status : value.done === true ? 'done' : 'todo'
      const startDate = isDateText(value.startDate) ? value.startDate : null
      const endDate =
        startDate !== null && isDateText(value.endDate) && value.endDate >= startDate ? value.endDate : null
      return {
        id: value.id,
        text: value.text,
        color: COLOR_IDS.includes(value.color) ? value.color : COLOR_IDS[0],
        status,
        pinned: value.pinned === true,
        startDate,
        endDate,
        createdAt: Number.isFinite(value.createdAt) ? value.createdAt : now,
        updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : now,
        x: Number.isFinite(value.x) ? value.x : Number.NaN,
        y: Number.isFinite(value.y) ? value.y : Number.NaN,
        width: Number.isFinite(value.width) ? value.width : Number.NaN,
        height: Number.isFinite(value.height) ? value.height : Number.NaN,
      }
    }

    function intersects(left, right) {
      return (
        left.x < right.x + right.width &&
        right.x < left.x + left.width &&
        left.y < right.y + right.height &&
        right.y < left.y + left.height
      )
    }

    /** First free slot scanning left to right, top to bottom. */
    function freeSlot(notes, viewportWidth) {      const columns = Math.max(1, Math.floor((Math.max(viewportWidth, DEFAULT_WIDTH) + GAP) / (DEFAULT_WIDTH + GAP)))
      for (let row = 0; row < 200; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const candidate = {
            x: column * (DEFAULT_WIDTH + GAP),
            y: row * (DEFAULT_HEIGHT + GAP),
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          }
          if (!notes.some((note) => intersects(note, candidate))) return { x: candidate.x, y: candidate.y }
        }
      }
      return { x: 0, y: notes.length * (DEFAULT_HEIGHT + GAP) }
    }

    /**
     * Snap one axis of a dragged card to a neighbour's leading edge, trailing
     * edge or centre, or to the standard gap beside it. Returns the snapped
     * start plus the guide line to draw (null when nothing was close enough).
     */
    function snapAxis(start, size, others, axis) {
      let best = null
      const consider = (value, guide, guided) => {
        if (value < 0) return
        const delta = Math.abs(value - start)
        if (delta > SNAP_THRESHOLD) return
        if (
          best === null ||
          delta < best.delta - 0.01 ||
          (Math.abs(delta - best.delta) <= 0.01 && guided && !best.guided)
        ) {
          best = { value, delta, guide, guided }
        }
      }
      consider(0, 0, true)
      for (const other of others) {
        const otherStart = axis === 'x' ? other.x : other.y
        const otherSize = axis === 'x' ? other.width : other.height
        const otherEnd = otherStart + otherSize
        /* Leading edges align: both cards start on one line. */
        consider(otherStart, otherStart, true)
        /* Trailing edges align: both cards end on one line. */
        consider(otherEnd - size, otherEnd, true)
        /* Centres align, which also tidies cards of different sizes. */
        consider(otherStart + (otherSize - size) / 2, otherStart + otherSize / 2, true)
        /* Sit right after or right before it, leaving the standard gap. */
        consider(otherEnd + GAP, otherEnd, false)
        consider(otherStart - GAP - size, otherStart, false)
      }
      if (best === null) return { start: Math.round(start), guide: null }
      return { start: Math.max(0, Math.round(best.value)), guide: Math.round(best.guide) }
    }

    /**
     * Snap the dragged edge of a resizing card (the corner handle moves its
     * right and bottom edges) to a neighbour's leading edge, trailing edge, or
     * the standard-gap position. The opposite edge stays pinned.
     */
    function snapEdge(start, size, others, axis) {
      const desiredEnd = start + size
      const smallest = axis === 'x' ? MIN_WIDTH : MIN_HEIGHT
      let best = null
      const consider = (end) => {
        if (end < start + smallest) return
        const delta = Math.abs(end - desiredEnd)
        if (delta > SNAP_THRESHOLD) return
        if (best === null || delta < best.delta) best = { end, delta }
      }
      for (const other of others) {
        const otherStart = axis === 'x' ? other.x : other.y
        const otherSize = axis === 'x' ? other.width : other.height
        /* Edge meets the neighbour's leading edge. */
        consider(otherStart)
        /* Edge stops the standard gap before the neighbour. */
        consider(otherStart - GAP)
        /* Trailing edges line up. */
        consider(otherStart + otherSize)
      }
      if (best === null) return { size: Math.round(size), guide: null }
      return { size: Math.max(smallest, Math.round(best.end - start)), guide: Math.round(best.end) }
    }

    /** Give notes stored before the free board a rectangle of their own. */
    function ensureGeometry(notes) {
      const placed = []
      return notes.map((note) => {
        if (Number.isFinite(note.x) && Number.isFinite(note.y) && Number.isFinite(note.width) && Number.isFinite(note.height)) {
          placed.push(note)
          return note
        }
        const slot = freeSlot(placed, DEFAULT_WIDTH * 3)
        const next = {
          ...note,
          x: slot.x,
          y: slot.y,
          width: Math.max(MIN_WIDTH, Number.isFinite(note.width) ? note.width : DEFAULT_WIDTH),
          height: Math.max(MIN_HEIGHT, Number.isFinite(note.height) ? note.height : DEFAULT_HEIGHT),
        }
        placed.push(next)
        return next
      })
    }

    function readStored() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return ensureGeometry(parsed.filter(isNote).map(normalizeNote))
      } catch (error) {
        return []
      }
    }

    function writeStored(notes) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
      } catch (error) {
        /* Storage can be unavailable in a private window; the session copy still works. */
      }
    }

    function newNoteId() {
      return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    }

    function accentOf(colorId) {
      const color = COLORS.find((candidate) => candidate.id === colorId) || COLORS[0]
      return color.accent
    }

    /** Package-owned stylesheet, disposed with the Client run. */
    function installStyles(css) {
      try {
        if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
          return styles.insert(css)
        }
      } catch (error) {
        console.error('work-notes: styles insertion failed', error)
      }
      const tag = document.createElement('style')
      tag.dataset.pluginCss = 'dsh-plugin-work-notes/panel.css'
      tag.textContent = css
      document.head.append(tag)
      return () => {
        tag.remove()
      }
    }

    function glyph(children, size) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        children,
      )
    }

    /** Sidebar row glyph: a note with a folded corner. */
    function NotesGlyph({ size = 16 }) {
      return glyph(
        [
          h('path', {
            key: 'body',
            d: 'M5.6 3.75h12.8a1.85 1.85 0 0 1 1.85 1.85v8.35l-6.3 6.3H5.6a1.85 1.85 0 0 1-1.85-1.85V5.6A1.85 1.85 0 0 1 5.6 3.75Z',
          }),
          h('path', { key: 'fold', d: 'M20.25 13.95h-4.5a1.8 1.8 0 0 0-1.8 1.8v4.5' }),
          h('path', { key: 'line-a', d: 'M7.4 8.4h7.2' }),
          h('path', { key: 'line-b', d: 'M7.4 11.9h4.6' }),
        ],
        size,
      )
    }

    function PinGlyph({ size = 13, filled = false }) {
      return glyph(
        [
          h('path', {
            key: 'pin',
            d: 'M9.1 3.75h5.8v1.55l-1.2 1.2v4.15l2.85 2.6v1.25H7.45v-1.25l2.85-2.6V6.5l-1.2-1.2V3.75Z',
            fill: filled ? 'currentColor' : 'none',
          }),
          h('path', { key: 'tip', d: 'M12 14.5v5.75' }),
        ],
        size,
      )
    }

    function TrashGlyph({ size = 13 }) {
      return glyph(
        [
          h('path', { key: 'lid', d: 'M4.9 7.1h14.2' }),
          h('path', { key: 'bail', d: 'M9.6 7.1V4.9h4.8v2.2' }),
          h('path', { key: 'bin', d: 'M6.75 7.1l.8 12.15h8.9l.8-12.15' }),
        ],
        size,
      )
    }

    function DropGlyph({ size = 13 }) {
      return glyph(
        [
          h('path', {
            key: 'drop',
            d: 'M12 3.9c3.35 3.55 5.15 6.35 5.15 8.5a5.15 5.15 0 0 1-10.3 0c0-2.15 1.8-4.95 5.15-8.5Z',
          }),
        ],
        size,
      )
    }

    function PlusGlyph({ size = 13 }) {
      return glyph([h('path', { key: 'plus', d: 'M12 5.6v12.8M5.6 12h12.8' })], size)
    }

    function ChevronGlyph({ size = 11 }) {
      return glyph([h('path', { key: 'chevron', d: 'M7 10.2l5 5 5-5' })], size)
    }

    function HelpGlyph({ size = 13 }) {
      return glyph(
        [
          h('circle', { key: 'ring', cx: 12, cy: 12, r: 8.4 }),
          h('path', { key: 'hook', d: 'M9.7 9.5a2.4 2.4 0 1 1 3.5 2.2c-.8.4-1.2 1-1.2 1.9' }),
          h('path', { key: 'dot', d: 'M12 17.2h.01' }),
        ],
        size,
      )
    }

    function CalendarGlyph({ size = 11 }) {
      return glyph(
        [
          h('path', {
            key: 'box',
            d: 'M4.6 6.6h14.8v12.2a1.6 1.6 0 0 1-1.6 1.6H6.2a1.6 1.6 0 0 1-1.6-1.6Z',
          }),
          h('path', { key: 'top', d: 'M4.6 10.2h14.8M8.2 3.8v4M15.8 3.8v4' }),
        ],
        size,
      )
    }

    /** Textarea that grows with the composer draft; note bodies instead fill their card. */
    function GrowingTextarea(props) {
      const ref = React.useRef(null)
      const resize = React.useCallback(() => {
        const element = ref.current
        if (element === null) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
      }, [])
      React.useEffect(() => {
        resize()
      }, [props.value, resize])
      return h('textarea', {
        ref,
        className: props.className,
        value: props.value,
        placeholder: props.placeholder,
        'aria-label': props.ariaLabel,
        rows: 1,
        spellCheck: false,
        onChange: (event) => {
          props.onChange(event.target.value)
        },
        onInput: resize,
        onKeyDown: props.onKeyDown,
      })
    }

    function createComponents(locale) {
      /** Re-bind texts when the page locale changes. */
      function useText() {
        const [, bump] = React.useState(0)
        React.useEffect(
          () =>
            locale.subscribe(() => {
              bump((value) => value + 1)
            }),
          [],
        )
        return React.useMemo(() => makeTranslate(locale), [])
      }

      function NotesPanelIcon({ size }) {
        return h(NotesGlyph, { size: size || 16 })
      }

      function WorkNotesPanel() {
        const t = useText()
        const [notes, setNotes] = React.useState(readStored)
        const [draft, setDraft] = React.useState('')
        const [draftColor, setDraftColor] = React.useState(COLOR_IDS[0])
        const [draftSkipDates, setDraftSkipDates] = React.useState(false)
        const [dayDraft, setDayDraft] = React.useState('')
        const [ganttDraft, setGanttDraft] = React.useState('')
        const [ganttWidth, setGanttWidth] = React.useState(0)
        const ganttScrollRef = React.useRef(null)
        const [confirmId, setConfirmId] = React.useState(null)
        const [openMenuId, setOpenMenuId] = React.useState(null)
        const [activeId, setActiveId] = React.useState(null)
        const [guides, setGuides] = React.useState(NO_GUIDES)
        const scrollRef = React.useRef(null)
        const interaction = React.useRef(null)
        const [view, setView] = React.useState(readStoredView)
        const [month, setMonth] = React.useState(() => monthOfDay(todayDay()))
        const [selectedDay, setSelectedDay] = React.useState(todayDay)
        const [picker, setPicker] = React.useState(null)
        const [pickerMonth, setPickerMonth] = React.useState(() => monthOfDay(todayDay()))
        const [draggingId, setDraggingId] = React.useState(null)
        const [dropDay, setDropDay] = React.useState(null)
        const [ganttActiveId, setGanttActiveId] = React.useState(null)
        const [focusId, setFocusId] = React.useState(null)
        const [helpOpen, setHelpOpen] = React.useState(false)
        const [monthPicker, setMonthPicker] = React.useState(null)
        const notesRef = React.useRef(notes)
        notesRef.current = notes
        const calendarDrag = React.useRef(null)
        const ganttDrag = React.useRef(null)

        React.useEffect(() => {
          const timer = window.setTimeout(() => writeStored(notes), 250)
          return () => window.clearTimeout(timer)
        }, [notes])

        const [, setClock] = React.useState(0)
        React.useEffect(() => {
          const timer = window.setInterval(() => setClock((value) => value + 1), 30_000)
          return () => window.clearInterval(timer)
        }, [])

        React.useEffect(() => {
          if (confirmId === null) return
          const timer = window.setTimeout(() => setConfirmId(null), 4000)
          return () => window.clearTimeout(timer)
        }, [confirmId])

        /* Status menu dismissal: any pointer press outside it, or Escape. */
        React.useEffect(() => {
          if (openMenuId === null) return
          const dismiss = (event) => {
            const target = event.target
            if (
              target instanceof Element &&
              (target.closest('.wn-menu') !== null || target.closest('.wn-status') !== null)
            ) {
              return
            }
            setOpenMenuId(null)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpenMenuId(null)
          }
          document.addEventListener('pointerdown', dismiss, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('pointerdown', dismiss, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [openMenuId])

        /* A drag must release even when the pointer ends outside the card. */
        React.useEffect(
          () => () => {
            interaction.current = null
          },
          [],
        )

        const counts = React.useMemo(() => {
          const result = { todo: 0, doing: 0, done: 0 }
          for (const note of notes) result[note.status] = (result[note.status] || 0) + 1
          return result
        }, [notes])

        /** Painted in edit order so the most recently touched card sits on top. */
        const stacked = React.useMemo(
          () => [...notes].sort((left, right) => left.updatedAt - right.updatedAt),
          [notes],
        )

        const canvasHeight = React.useMemo(
          () => notes.reduce((tallest, note) => Math.max(tallest, note.y + note.height), 0) + 24,
          [notes],
        )

        const patchNote = React.useCallback((id, patch) => {
          setNotes((current) =>
            current.map((note) => (note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note)),
          )
        }, [])

        /** Geometry-only update: moving a card is not an edit of its content. */
        const placeNote = React.useCallback((id, patch) => {
          setNotes((current) => current.map((note) => (note.id === id ? { ...note, ...patch } : note)))
        }, [])

        const removeNote = React.useCallback((id) => {
          setNotes((current) => current.filter((note) => note.id !== id))
          setConfirmId(null)
        }, [])

        const cycleColor = React.useCallback((id) => {
          setNotes((current) =>
            current.map((note) => {
              if (note.id !== id) return note
              const next = COLOR_IDS[(COLOR_IDS.indexOf(note.color) + 1) % COLOR_IDS.length]
              return { ...note, color: next, updatedAt: Date.now() }
            }),
          )
        }, [])

        const addNote = React.useCallback(() => {
          const text = draft.trim()
          if (text === '') return
          const now = Date.now()
          const inferred = draftSkipDates ? null : inferDates(text, todayDay())
          const viewport = scrollRef.current === null ? DEFAULT_WIDTH * 3 : scrollRef.current.clientWidth - 48
          const slot = freeSlot(notes, viewport)
          setNotes((current) => [
            {
              id: newNoteId(),
              text,
              color: draftColor,
              status: 'todo',
              pinned: false,
              startDate: inferred === null ? null : dateOf(inferred.start),
              endDate: inferred === null || inferred.end === null ? null : dateOf(inferred.end),
              createdAt: now,
              updatedAt: now,
              x: slot.x,
              y: slot.y,
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
            },
            ...current,
          ])
          setDraft('')
          setDraftSkipDates(false)
        }, [draft, draftColor, draftSkipDates, notes])

        /** Create a note straight onto a calendar day; explicit dates in the text win. */
        const addNoteOnDay = React.useCallback(
          (day) => {
            const text = dayDraft.trim()
            if (text === '') return
            const inferred = inferDates(text, todayDay())
            const start = inferred === null ? day : inferred.start
            const end = inferred === null ? null : inferred.end
            const now = Date.now()
            const viewport = scrollRef.current === null ? DEFAULT_WIDTH * 3 : scrollRef.current.clientWidth - 48
            const slot = freeSlot(notes, viewport)
            setNotes((current) => [
              {
                id: newNoteId(),
                text,
                color: draftColor,
                status: 'todo',
                pinned: false,
                startDate: dateOf(start),
                endDate: end === null ? null : dateOf(end),
                createdAt: now,
                updatedAt: now,
                x: slot.x,
                y: slot.y,
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT,
              },
              ...current,
            ])
            setDayDraft('')
          },
          [dayDraft, draftColor, notes],
        )

        /** Gantt composer: a note dated from its own text, else today. */
        const addNoteFromGantt = React.useCallback(() => {
          const text = ganttDraft.trim()
          if (text === '') return
          const inferred = inferDates(text, todayDay())
          const start = inferred === null ? todayDay() : inferred.start
          const end = inferred === null ? null : inferred.end
          const now = Date.now()
          const viewport = scrollRef.current === null ? DEFAULT_WIDTH * 3 : scrollRef.current.clientWidth - 48
          const slot = freeSlot(notes, viewport)
          setNotes((current) => [
            {
              id: newNoteId(),
              text,
              color: draftColor,
              status: 'todo',
              pinned: false,
              startDate: dateOf(start),
              endDate: end === null ? null : dateOf(end),
              createdAt: now,
              updatedAt: now,
              x: slot.x,
              y: slot.y,
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
            },
            ...current,
          ])
          setGanttDraft('')
        }, [ganttDraft, draftColor, notes])

        /** Date popover: first click sets the start, the next one sets the end. */
        const pickDate = (note, day) => {
          if (note.startDate === null || note.endDate !== null) {
            patchNote(note.id, { startDate: dateOf(day), endDate: null })
            return
          }
          const start = dayOf(note.startDate)
          if (day < start) {
            patchNote(note.id, { startDate: dateOf(day), endDate: null })
            return
          }
          patchNote(note.id, { startDate: note.startDate, endDate: day === start ? null : dateOf(day) })
        }

        const jumpToNote = (id) => {
          setView('notes')
          setFocusId(id)
        }

        const beginGanttDrag = (note, mode, event) => {
          if (event.button !== 0) return
          const range = dayRange(note)
          if (range === null) return
          event.preventDefault()
          event.stopPropagation()
          ganttDrag.current = {
            id: note.id,
            mode,
            pointerId: event.pointerId,
            startX: event.clientX,
            trackWidth: (() => {
              const track = event.currentTarget === null ? null : event.currentTarget.closest?.('.wn-ganttTrack')
              return track == null ? 0 : track.getBoundingClientRect().width
            })(),
            totalDays: (() => {
              const track = event.currentTarget === null ? null : event.currentTarget.closest?.('.wn-ganttTrack')
              const days = track == null ? Number.NaN : Number(track.getAttribute('data-days'))
              return Number.isFinite(days) && days > 0 ? days : 30
            })(),
            baseStart: range.start,
            baseEnd: range.end,
            lastStart: range.start,
            lastEnd: range.end,
          }
          setGanttActiveId(note.id)
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch (error) {
            /* Capture is an accelerator only. */
          }
        }

        /** Move the whole bar, or one of its ends, in whole-day steps. */
        const moveGanttDrag = (event) => {
          const active = ganttDrag.current
          if (active === null || active.pointerId !== event.pointerId) return
          const dayWidth =
            active.trackWidth > 0 && active.totalDays > 0 ? active.trackWidth / active.totalDays : DAY_WIDTH
          const delta = Math.round((event.clientX - active.startX) / Math.max(4, dayWidth))
          if (!Number.isFinite(delta)) return
          if (active.mode === 'move') {
            if (delta === 0) return
          }
          let start = active.baseStart
          let end = active.baseEnd
          if (active.mode === 'move') {
            start += delta
            end += delta
          } else if (active.mode === 'start') {
            start = Math.min(active.baseStart + delta, active.baseEnd)
          } else {
            end = Math.max(active.baseEnd + delta, active.baseStart)
          }
          if (start === active.lastStart && end === active.lastEnd) return
          active.lastStart = start
          active.lastEnd = end
          patchNote(active.id, { startDate: dateOf(start), endDate: start === end ? null : dateOf(end) })
        }

        const endGanttDrag = (event) => {
          const active = ganttDrag.current
          if (active === null || active.pointerId !== event.pointerId) return
          ganttDrag.current = null
          setGanttActiveId(null)
        }

        React.useEffect(() => {
          writeStoredView(view)
        }, [view])

        /* Track width drives the Gantt day width, so the timeline fills the pane. */
        React.useEffect(() => {
          const element = ganttScrollRef.current
          if (element === null) return
          const measure = () => setGanttWidth(element.clientWidth)
          measure()
          if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure)
            return () => window.removeEventListener('resize', measure)
          }
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }, [view])

        /* Calendar chip drag: window-level, so the pointer may cross cells. */
        React.useEffect(() => {
          if (draggingId === null) return
          const dayUnder = (event) => {
            const element = document.elementFromPoint(event.clientX, event.clientY)
            const cell = element instanceof Element ? element.closest('[data-day]') : null
            const value = cell === null ? null : Number(cell.getAttribute('data-day'))
            return Number.isFinite(value) ? value : null
          }
          const move = (event) => {
            setDropDay(dayUnder(event))
          }
          const finish = (event) => {
            const active = calendarDrag.current
            const day = dayUnder(event)
            calendarDrag.current = null
            setDraggingId(null)
            setDropDay(null)
            if (active === null || day === null || day === active.grabbedDay) return
            const note = notesRef.current.find((candidate) => candidate.id === active.id)
            if (note === undefined) return
            const range = dayRange(note)
            if (range === null) {
              patchNote(active.id, { startDate: dateOf(day), endDate: null })
              return
            }
            /* Keep the span length and land the range's start on the drop day. */
            const span = range.end - range.start
            patchNote(active.id, { startDate: dateOf(day), endDate: span > 0 ? dateOf(day + span) : null })
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', finish)
          window.addEventListener('pointercancel', finish)
          return () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', finish)
            window.removeEventListener('pointercancel', finish)
          }
        }, [draggingId, patchNote])

        /* Date popover dismissal. */
        React.useEffect(() => {
          if (picker === null) return
          const dismiss = (event) => {
            const target = event.target
            if (
              target instanceof Element &&
              (target.closest('.wn-picker') !== null || target.closest('.wn-dateChip') !== null)
            ) {
              return
            }
            setPicker(null)
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') setPicker(null)
          }
          document.addEventListener('pointerdown', dismiss, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('pointerdown', dismiss, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [picker])

        /* Bring a jumped-to card into view, then drop its highlight. */
        React.useEffect(() => {
          if (focusId === null || view !== 'notes') return
          const container = scrollRef.current
          if (container !== null) {
            const card = container.querySelector(`[data-note-id="${focusId}"]`)
            if (card !== null) card.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
          const timer = window.setTimeout(() => setFocusId(null), 2000)
          return () => window.clearTimeout(timer)
        }, [focusId, view])

        /** Backfill: date every unscheduled note whose own text names a date. */
        const autoSchedule = React.useCallback(() => {
          const base = todayDay()
          setNotes((current) =>
            current.map((note) => {
              if (note.startDate !== null) return note
              const dates = inferDates(note.text, base)
              if (dates === null) return note
              return {
                ...note,
                startDate: dateOf(dates.start),
                endDate: dates.end === null ? null : dateOf(dates.end),
                updatedAt: Date.now(),
              }
            }),
          )
        }, [])

        /* Month picker and help share one dismissal: Escape, or a press outside them. */
        React.useEffect(() => {
          if (helpOpen === false && monthPicker === null) return
          const onKeyDown = (event) => {
            if (event.key !== 'Escape') return
            setHelpOpen(false)
            setMonthPicker(null)
          }
          const onPointerDown = (event) => {
            const target = event.target
            const insideMonth = target instanceof Element && target.closest('.wn-monthPicker, .wn-monthLabel') !== null
            if (!insideMonth) setMonthPicker(null)
            const insideHelp = target instanceof Element && target.closest('.wn-help, .wn-helpBtn') !== null
            if (!insideHelp) setHelpOpen(false)
          }
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [helpOpen, monthPicker])

        const beginInteraction = (kind, note, event) => {
          if (event.button !== 0) return
          event.preventDefault()
          interaction.current = {
            kind,
            id: note.id,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            baseX: note.x,
            baseY: note.y,
            baseWidth: note.width,
            baseHeight: note.height,
          }
          setActiveId(note.id)
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch (error) {
            /* Capture is an accelerator; move events still arrive without it. */
          }
        }

        const moveInteraction = (event) => {
          const current = interaction.current
          if (current === null || current.pointerId !== event.pointerId) return
          const dx = event.clientX - current.startX
          const dy = event.clientY - current.startY
          const others = notes.filter((note) => note.id !== current.id)
          /* Alt suspends snapping for deliberate fine placement. */
          if (event.altKey) {
            setGuides(NO_GUIDES)
            placeNote(
              current.id,
              current.kind === 'move'
                ? { x: Math.max(0, current.baseX + dx), y: Math.max(0, current.baseY + dy) }
                : {
                    width: Math.max(MIN_WIDTH, current.baseWidth + dx),
                    height: Math.max(MIN_HEIGHT, current.baseHeight + dy),
                  },
            )
            return
          }
          if (current.kind === 'move') {
            const snappedX = snapAxis(Math.max(0, current.baseX + dx), current.baseWidth, others, 'x')
            const snappedY = snapAxis(Math.max(0, current.baseY + dy), current.baseHeight, others, 'y')
            setGuides({ x: snappedX.guide, y: snappedY.guide })
            placeNote(current.id, { x: snappedX.start, y: snappedY.start })
          } else {
            const snappedWidth = snapEdge(current.baseX, Math.max(MIN_WIDTH, current.baseWidth + dx), others, 'x')
            const snappedHeight = snapEdge(current.baseY, Math.max(MIN_HEIGHT, current.baseHeight + dy), others, 'y')
            setGuides({ x: snappedWidth.guide, y: snappedHeight.guide })
            placeNote(current.id, { width: snappedWidth.size, height: snappedHeight.size })
          }
        }

        const endInteraction = (event) => {
          const current = interaction.current
          if (current === null || current.pointerId !== event.pointerId) return
          interaction.current = null
          setActiveId(null)
          setGuides(NO_GUIDES)
        }

        /** Pointer-owning start on the card; interactive children keep their own gesture. */
        const startCardGesture = (note, event) => {
          const target = event.target
          if (target instanceof Element && target.closest('button, select, textarea, .wn-resize')) return
          beginInteraction('move', note, event)
        }

        const today = todayDay()

        /** Notes whose range covers the day, ordered by start then creation. */
        const notesOnDay = (day) => {
          const result = []
          for (const note of notes) {
            const range = dayRange(note)
            if (range !== null && day >= range.start && day <= range.end) result.push(note)
          }
          return result.sort((left, right) => {
            const leftRange = dayRange(left)
            const rightRange = dayRange(right)
            return leftRange.start - rightRange.start || left.createdAt - right.createdAt
          })
        }

        const navButton = (direction, onClick, label, key) =>
          h(
            'button',
            { key, type: 'button', className: 'wn-navBtn', title: label, 'aria-label': label, onClick },
            h(
              'span',
              { style: { display: 'inline-flex', transform: `rotate(${direction === 'prev' ? 90 : -90}deg)` } },
              h(ChevronGlyph, { size: 12 }),
            ),
          )

        /** Compact month popover used to set a note's start/end day. */
        const renderPicker = (note) => {
          const cells = monthCells(pickerMonth)
          const start = note.startDate === null ? null : dayOf(note.startDate)
          const end = start === null ? null : note.endDate === null ? start : dayOf(note.endDate)
          const hint = note.startDate === null || note.endDate !== null ? t('date.pickStart') : t('date.pickEnd')
          return [
            h(
              'div',
              { className: 'wn-pickerHead', key: 'head' },
              h(
                'span',
                { className: 'wn-pickerTitle' },
                fill(t('calendar.month'), { y: pickerMonth.year, m: pickerMonth.month + 1 }),
              ),
              navButton('prev', () => setPickerMonth(shiftMonth(pickerMonth, -1)), t('calendar.prev'), 'prev'),
              navButton('next', () => setPickerMonth(shiftMonth(pickerMonth, 1)), t('calendar.next'), 'next'),
            ),
            h(
              'div',
              { className: 'wn-pickerGrid', key: 'grid' },
              WEEKDAYS.map((key) => h('span', { className: 'wn-pickerWeekday', key }, t(key))),
              cells.map((day) =>
                h(
                  'button',
                  {
                    key: day,
                    type: 'button',
                    className: 'wn-pickerDay',
                    'data-outside': String(monthOfDay(day).month !== pickerMonth.month),
                    'data-today': String(day === today),
                    'data-in-range': String(start !== null && day >= start && day <= end),
                    onClick: () => pickDate(note, day),
                  },
                  String(dayNumber(day)),
                ),
              ),
            ),
            h(
              'div',
              { className: 'wn-pickerFoot', key: 'foot' },
              h('span', { className: 'wn-pickerHint' }, hint),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wn-pickerAction',
                  onClick: () => {
                    patchNote(note.id, { startDate: null, endDate: null })
                    setPicker(null)
                  },
                },
                t('date.clear'),
              ),
              h(
                'button',
                { type: 'button', className: 'wn-pickerAction', onClick: () => pickDate(note, today) },
                t('calendar.today'),
              ),
            ),
          ]
        }

        const calendarView = h(
          'div',
          null,
          h(
            'div',
            { className: 'wn-viewHead' },
            h(
              'button',
              {
                type: 'button',
                className: 'wn-monthLabel',
                title: t('month.pick'),
                onClick: (event) => {
                  if (monthPicker !== null) {
                    setMonthPicker(null)
                    return
                  }
                  const rect = event.currentTarget.getBoundingClientRect()
                  const width = 216
                  const height = 214
                  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
                  const top =
                    rect.bottom + height + 8 > window.innerHeight
                      ? Math.max(8, rect.top - height - 6)
                      : rect.bottom + 6
                  setMonthPicker({ left, top })
                },
              },
              fill(t('calendar.month'), { y: month.year, m: month.month + 1 }),
              h(ChevronGlyph, { size: 10 }),
            ),
            navButton('prev', () => setMonth(shiftMonth(month, -1)), t('calendar.prev'), 'prev'),
            navButton('next', () => setMonth(shiftMonth(month, 1)), t('calendar.next'), 'next'),
            h(
              'button',
              {
                type: 'button',
                className: 'wn-navText',
                onClick: () => {
                  const day = todayDay()
                  setMonth(monthOfDay(day))
                  setSelectedDay(day)
                },
              },
              t('calendar.today'),
            ),
          ),
          h(
            'div',
            { className: 'wn-weekRow' },
            WEEKDAYS.map((key, index) =>
              h('span', { className: 'wn-weekCell', key, 'data-stripe': String(index % 2 === 1) }, t(key)),
            ),
          ),
          h(
            'div',
            { className: 'wn-monthGrid' },
            monthCells(month).map((day) => {
              const entries = notesOnDay(day)
              const annotation = annotateDay(day)
              return h(
                'div',
                {
                  key: day,
                  className: 'wn-dayCell',
                  'data-day': String(day),
                  'data-stripe': String(weekdayOf(day) % 2 === 1),
                  'data-outside': String(monthOfDay(day).month !== month.month),
                  'data-today': String(day === today),
                  'data-selected': String(day === selectedDay),
                  'data-drop': String(dropDay === day),
                  onPointerDown: () => setSelectedDay(day),
                },
                h('span', { className: 'wn-dayNum' }, String(dayNumber(day))),
                annotation.lunar === null
                  ? null
                  : h('span', { className: 'wn-dayNote', 'data-kind': 'lunar' }, annotation.lunar),
                annotation.event === null
                  ? null
                  : h(
                      'span',
                      { className: 'wn-dayNote', 'data-kind': annotation.event.kind },
                      annotation.event.text,
                    ),
                entries.slice(0, 3).map((note) =>
                  h(
                    'span',
                    {
                      key: note.id,
                      className: 'wn-chip',
                      style: { '--wn-status-color': statusColor(note.status) },
                      'data-dragging': String(draggingId === note.id),
                      title: `${note.text} · ${rangeLabel(note, t)}`,
                      onPointerDown: (event) => {
                        event.stopPropagation()
                        setSelectedDay(day)
                        if (dayRange(note) === null) return
                        calendarDrag.current = { id: note.id, grabbedDay: day }
                        setDraggingId(note.id)
                      },
                    },
                    h('span', { className: 'wn-chipText' }, note.text),
                  ),
                ),
                entries.length > 3
                  ? h('span', { className: 'wn-chipMore' }, fill(t('calendar.more'), { n: entries.length - 3 }))
                  : null,
              )
            }),
          ),
          h(
            'div',
            { className: 'wn-dayList' },
            h(
              'div',
              { className: 'wn-dayListTitle' },
              fill(t('calendar.dayTitle'), {
                m: monthOfDay(selectedDay).month + 1,
                d: dayNumber(selectedDay),
              }),
            ),
            h(
              'div',
              { className: 'wn-dayComposer' },
              h('input', {
                className: 'wn-dayInput',
                value: dayDraft,
                placeholder: fill(t('calendar.addPlaceholder'), { range: shortDate(selectedDay, t) }),
                'aria-label': t('calendar.add'),
                onChange: (event) => setDayDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addNoteOnDay(selectedDay)
                  } else if (event.key === 'Escape') {
                    setDayDraft('')
                  }
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wn-dayAdd',
                  disabled: dayDraft.trim() === '',
                  onClick: () => addNoteOnDay(selectedDay),
                },
                t('calendar.add'),
              ),
            ),
            notesOnDay(selectedDay).length === 0
              ? h('div', { className: 'wn-emptyMini' }, t('calendar.dayEmpty'))
              : notesOnDay(selectedDay).map((note) =>
                  h(
                    'div',
                    { key: note.id, className: 'wn-dayItem', onClick: () => jumpToNote(note.id) },
                    h('span', {
                      className: 'wn-statusDotSmall',
                      style: { color: statusColor(note.status) },
                      'aria-hidden': 'true',
                    }),
                    h('span', { className: 'wn-dayItemText' }, note.text),
                    h('span', { className: 'wn-dayItemRange' }, rangeLabel(note, t)),
                    confirmId === note.id
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'wn-iconBtn',
                            'data-danger': 'true',
                            title: t('note.delete'),
                            onClick: (event) => {
                              event.stopPropagation()
                              removeNote(note.id)
                            },
                          },
                          t('note.confirmDelete'),
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'wn-iconBtn',
                            'aria-label': t('note.delete'),
                            title: t('note.delete'),
                            onClick: (event) => {
                              event.stopPropagation()
                              setConfirmId(note.id)
                            },
                          },
                          h(TrashGlyph, { size: 13 }),
                        ),
                  ),
                ),
          ),
        )

        /** Timeline window: every dated note, padded around today, capped at 180 days. */
        const gantt = React.useMemo(() => {
          const items = notes
            .filter((note) => note.startDate !== null)
            .map((note) => ({ note, range: dayRange(note) }))
            .sort((left, right) => left.range.start - right.range.start || left.note.createdAt - right.note.createdAt)
          if (items.length === 0) return { items, start: todayDay() - 7, days: 30 }
          const now = todayDay()
          let start = Math.min(...items.map((item) => item.range.start))
          let end = Math.max(...items.map((item) => item.range.end))
          start = Math.min(start, now) - 2
          end = Math.max(end, now) + 2
          if (end - start + 1 > 180) end = start + 179
          return { items, start, days: end - start + 1 }
        }, [notes])

        const ganttView = (() => {
          if (gantt.items.length === 0) return h('div', { className: 'wn-emptyMini' }, t('gantt.empty'))
          const days = []
          for (let index = 0; index < gantt.days; index += 1) days.push(gantt.start + index)
          const segments = []
          for (const day of days) {
            const month = monthOfDay(day)
            const label = fill(t('calendar.month'), { y: month.year, m: month.month + 1 })
            const last = segments[segments.length - 1]
            if (last !== undefined && last.label === label) last.days += 1
            else segments.push({ label, days: 1 })
          }
          const todayOffset =
            today >= gantt.start && today < gantt.start + gantt.days ? today - gantt.start : null
          const unscheduled = notes.length - gantt.items.length
          /* Whole-pixel day width: fills the pane when the range is short, scrolls when it is long. */
          const available = Math.max(0, ganttWidth - 216)
          const dayWidth =
            ganttWidth > 0 && gantt.days > 0 ? Math.max(18, Math.floor(available / gantt.days)) : DAY_WIDTH
          return h(
            'div',
            { className: 'wn-gantt' },
            h(
              'div',
              { className: 'wn-ganttHead' },
              h('div', { className: 'wn-ganttLeft' }),
              h(
                'div',
                { className: 'wn-ganttHeadRight' },
                h(
                  'div',
                  { className: 'wn-ganttMonths' },
                  segments.map((segment, index) =>
                    h(
                      'div',
                      {
                        key: index,
                        className: 'wn-ganttMonthSeg',
                        style: { width: `${segment.days * dayWidth}px` },
                      },
                      segment.label,
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'wn-ganttCells' },
                  days.map((day) =>
                    h(
                      'div',
                      {
                        key: day,
                        className: 'wn-ganttCell',
                        style: { width: `${dayWidth}px` },
                        'data-odd': String(((day - gantt.start) % 2) === 1),
                        'data-weekend': String(weekdayOf(day) >= 5),
                        'data-today': String(day === today),
                        title: dateOf(day),
                      },
                      String(dayNumber(day)),
                    ),
                  ),
                ),
              ),
            ),
            gantt.items.map(({ note, range }) =>
              h(
                'div',
                { key: note.id, className: 'wn-ganttRow' },
                h(
                  'div',
                  { className: 'wn-ganttLeft', title: note.text },
                  h('span', {
                    className: 'wn-statusDotSmall',
                    style: { color: statusColor(note.status) },
                    'aria-hidden': 'true',
                  }),
                  h('span', { className: 'wn-ganttLabel', onClick: () => jumpToNote(note.id) }, note.text),
                  confirmId === note.id
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-iconBtn',
                          'data-danger': 'true',
                          title: t('note.delete'),
                          onClick: () => removeNote(note.id),
                        },
                        t('note.confirmDelete'),
                      )
                    : h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-iconBtn',
                          'aria-label': t('note.delete'),
                          title: t('note.delete'),
                          onClick: () => setConfirmId(note.id),
                        },
                        h(TrashGlyph, { size: 13 }),
                      ),
                ),
                h(
                  'div',
                  {
                    className: 'wn-ganttTrack',
                    'data-days': String(gantt.days),
                    style: { width: `${gantt.days * dayWidth}px`, '--wn-day-width': `${dayWidth}px` },
                  },
                  todayOffset === null
                    ? null
                    : h('div', { className: 'wn-ganttToday', style: { left: `${todayOffset * dayWidth}px` } }),
                  h(
                    'div',
                    {
                      className: 'wn-ganttBar',
                      'data-active': String(ganttActiveId === note.id),
                      style: {
                        left: `${(range.start - gantt.start) * dayWidth + 2}px`,
                        width: `${Math.max(1, range.end - range.start + 1) * dayWidth - 4}px`,
                        '--wn-status-color': statusColor(note.status),
                      },
                      title: `${note.text} · ${rangeLabel(note, t)}`,
                      onPointerDown: (event) => beginGanttDrag(note, 'move', event),
                      onPointerMove: moveGanttDrag,
                      onPointerUp: endGanttDrag,
                      onPointerCancel: endGanttDrag,
                    },
                    h('div', {
                      className: 'wn-ganttHandle',
                      'data-side': 'start',
                      title: t('date.pickStart'),
                      onPointerDown: (event) => beginGanttDrag(note, 'start', event),
                    }),
                    h('div', {
                      className: 'wn-ganttHandle',
                      'data-side': 'end',
                      title: t('date.pickEnd'),
                      onPointerDown: (event) => beginGanttDrag(note, 'end', event),
                    }),
                    h('span', null, rangeLabel(note, t)),
                  ),
                ),
              ),
            ),
            unscheduled > 0
              ? h('div', { className: 'wn-hintLine' }, fill(t('gantt.unscheduled'), { n: unscheduled }))
              : null,
          )
        })()

        /* Show what the draft's own words were understood as, before it is added. */
        const inferredDraft = draft.trim() === '' ? null : inferDates(draft, today)

        const composer = h(
          'div',
          { className: 'wn-composerWrap' },
          h(
            'div',
            { className: 'wn-composer' },
            h(GrowingTextarea, {
              className: 'wn-composerInput',
              value: draft,
              placeholder: t('composer.placeholder'),
              ariaLabel: t('composer.add'),
              onChange: setDraft,
              onKeyDown: (event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  addNote()
                }
              },
            }),
            h(
              'div',
              { className: 'wn-composerBar' },
              h(
                'div',
                { className: 'wn-dots' },
                COLORS.map((color) =>
                  h('button', {
                    key: color.id,
                    type: 'button',
                    className: 'wn-dot',
                    style: { '--wn-accent': color.accent },
                    'data-active': String(color.id === draftColor),
                    'aria-label': t('note.color'),
                    'aria-pressed': color.id === draftColor,
                    title: t('note.color'),
                    onClick: () => setDraftColor(color.id),
                  }),
                ),
              ),
              inferredDraft === null
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'wn-inferChip',
                      'data-ignored': String(draftSkipDates),
                      title: t('infer.dropTitle'),
                      onClick: () => setDraftSkipDates(!draftSkipDates),
                    },
                    h(CalendarGlyph, { size: 10 }),
                    h(
                      'span',
                      null,
                      draftSkipDates
                        ? t('infer.drop')
                        : fill(t('infer.detected'), { range: describeRange(inferredDraft, t) }),
                    ),
                  ),
              h('span', { className: 'wn-hint' }, t('composer.hint')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wn-addBtn',
                  disabled: draft.trim() === '',
                  onClick: addNote,
                },
                h(PlusGlyph, { size: 13 }),
                h('span', null, t('composer.add')),
              ),
            ),
          ),
        )

        const board =
          notes.length === 0
            ? h(
                'div',
                { className: 'wn-empty' },
                h(NotesGlyph, { size: 28 }),
                h('div', { className: 'wn-emptyTitle' }, t('empty.title')),
                h('div', { className: 'wn-emptyBody' }, t('empty.body')),
              )
            : h(
                'div',
                { className: 'wn-canvas', style: { height: `${canvasHeight}px` } },
                guides.x === null
                  ? null
                  : h('div', { className: 'wn-guide wn-guideX', style: { left: `${guides.x}px` } }),
                guides.y === null
                  ? null
                  : h('div', { className: 'wn-guide wn-guideY', style: { top: `${guides.y}px` } }),
                stacked.map((note) =>
                  h(
                    'article',
                    {
                      key: note.id,
                      className: 'wn-note',
                      style: {
                        '--wn-accent': accentOf(note.color),
                        left: `${note.x}px`,
                        top: `${note.y}px`,
                        width: `${note.width}px`,
                        height: `${note.height}px`,
                      },
                      'data-pinned': String(note.pinned),
                      'data-status': note.status,
                      'data-active': String(activeId === note.id),
                      'data-menu': String(openMenuId === note.id),
                      'data-focus': String(focusId === note.id),
                      'data-note-id': note.id,
                      onPointerDown: (event) => startCardGesture(note, event),
                      onPointerMove: moveInteraction,
                      onPointerUp: endInteraction,
                      onPointerCancel: endInteraction,
                    },
                    h(
                      'div',
                      { className: 'wn-noteHead' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-status',
                          'data-status': note.status,
                          'data-open': String(openMenuId === note.id),
                          'aria-haspopup': 'menu',
                          'aria-expanded': openMenuId === note.id,
                          'aria-label': t('status.label'),
                          title: t('status.label'),
                          onClick: () => setOpenMenuId(openMenuId === note.id ? null : note.id),
                        },
                        h('span', { className: 'wn-statusDot', 'aria-hidden': 'true' }),
                        h('span', null, t(`status.${note.status}`)),
                        h(ChevronGlyph, { size: 11 }),
                      ),
                      h('span', { className: 'wn-grip', title: t('drag.hint'), 'aria-hidden': 'true' }),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-iconBtn',
                          'data-on': String(note.pinned),
                          'aria-pressed': note.pinned,
                          'aria-label': note.pinned ? t('note.unpin') : t('note.pin'),
                          title: note.pinned ? t('note.unpin') : t('note.pin'),
                          onClick: () => patchNote(note.id, { pinned: !note.pinned }),
                        },
                        h(PinGlyph, { size: 13, filled: note.pinned }),
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-iconBtn',
                          'aria-label': t('note.color'),
                          title: t('note.color'),
                          onClick: () => cycleColor(note.id),
                        },
                        h(DropGlyph, { size: 13 }),
                      ),
                      confirmId === note.id
                        ? h(
                            'button',
                            {
                              type: 'button',
                              className: 'wn-iconBtn',
                              'data-danger': 'true',
                              title: t('note.delete'),
                              onClick: () => removeNote(note.id),
                            },
                            t('note.confirmDelete'),
                          )
                        : h(
                            'button',
                            {
                              type: 'button',
                              className: 'wn-iconBtn',
                              'aria-label': t('note.delete'),
                              title: t('note.delete'),
                              onClick: () => setConfirmId(note.id),
                            },
                            h(TrashGlyph, { size: 13 }),
                          ),
                    ),
                    openMenuId === note.id
                      ? h(
                          'div',
                          { className: 'wn-menu', role: 'menu', 'aria-label': t('status.label') },
                          STATUS_IDS.map((status) =>
                            h(
                              'button',
                              {
                                key: status,
                                type: 'button',
                                role: 'menuitemradio',
                                'aria-checked': note.status === status,
                                className: 'wn-menuItem',
                                'data-current': String(note.status === status),
                                onClick: () => {
                                  patchNote(note.id, { status })
                                  setOpenMenuId(null)
                                },
                              },
                              h('span', { className: 'wn-menuDot', 'data-status': status, 'aria-hidden': 'true' }),
                              h('span', null, t(`status.${status}`)),
                            ),
                          ),
                        )
                      : null,
                    note.status === 'done'
                      ? h('p', { className: 'wn-noteText' }, note.text)
                      : h('textarea', {
                          className: 'wn-noteInput',
                          value: note.text,
                          placeholder: t('composer.placeholder'),
                          'aria-label': t('panel.title'),
                          spellCheck: false,
                          onChange: (event) => patchNote(note.id, { text: event.target.value }),
                          onBlur: (event) => {
                            if (event.target.value.trim() === '') removeNote(note.id)
                          },
                        }),
                    h(
                      'div',
                      { className: 'wn-noteFoot' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'wn-dateChip',
                          'data-empty': String(note.startDate === null),
                          'data-open': String(picker !== null && picker.id === note.id),
                          title: note.startDate === null ? t('date.set') : rangeLabel(note, t),
                          onClick: (event) => {
                            if (picker !== null && picker.id === note.id) {
                              setPicker(null)
                              return
                            }
                            /* Fixed popover: measure the chip so the picker escapes card clipping. */
                            const rect = event.currentTarget.getBoundingClientRect()
                            const width = 232
                            const height = 240
                            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
                            const top =
                              rect.bottom + height + 8 > window.innerHeight
                                ? Math.max(8, rect.top - height - 6)
                                : rect.bottom + 6
                            setPicker({ id: note.id, left, top })
                            setPickerMonth(
                              monthOfDay(note.startDate === null ? todayDay() : dayOf(note.startDate)),
                            )
                          },
                        },
                        h(CalendarGlyph, { size: 10 }),
                        h('span', null, note.startDate === null ? t('date.set') : rangeLabel(note, t)),
                      ),
                      h(
                        'span',
                        { className: 'wn-noteMeta', title: new Date(note.updatedAt).toLocaleString() },
                        formatTime(note.updatedAt, t),
                      ),
                    ),
                    h('div', {
                      className: 'wn-resize',
                      role: 'presentation',
                      title: t('note.resize'),
                      onPointerDown: (event) => {
                        event.stopPropagation()
                        beginInteraction('resize', note, event)
                      },
                    }),
                  ),
                ),
              )

        const inferableCount = notes.filter(
          (note) => note.startDate === null && inferDates(note.text, today) !== null,
        ).length

        const viewTabs = h(
          'div',
          { className: 'wn-tabs', role: 'tablist', 'aria-label': t('panel.title') },
          ['notes', 'calendar', 'gantt'].map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                role: 'tab',
                className: 'wn-tab',
                'data-active': String(view === id),
                'aria-selected': view === id,
                onClick: () => setView(id),
              },
              t(`view.${id}`),
            ),
          ),
        )

        const footerHint =
          view === 'calendar' ? t('calendar.dragHint') : view === 'gantt' ? t('gantt.dragHint') : t('drag.hint')

        return h(
          'div',
          { className: 'wn-root' },
          h(
            'header',
            { className: 'wn-head' },
            h(
              'div',
              null,
              h(
                'div',
                { className: 'wn-titleRow' },
                h('h1', { className: 'wn-title' }, t('panel.title')),
                h('span', { className: 'wn-count' }, fill(t('panel.count'), { n: notes.length })),
                counts.doing > 0
                  ? h(
                      'span',
                      { className: 'wn-count', 'data-tone': 'doing' },
                      fill(t('panel.doing'), { n: counts.doing }),
                    )
                  : null,
                counts.done > 0
                  ? h(
                      'span',
                      { className: 'wn-count', 'data-tone': 'done' },
                      fill(t('panel.done'), { n: counts.done }),
                    )
                  : null,
              ),
              h('div', { className: 'wn-sub' }, t('panel.subtitle')),
            ),
            h(
              'div',
              { className: 'wn-headActions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'wn-helpBtn',
                  title: t('help.open'),
                  onClick: () => setHelpOpen(true),
                },
                h(HelpGlyph, { size: 13 }),
                h('span', null, t('help.open')),
              ),
              viewTabs,
            ),
          ),
          view === 'notes' ? composer : null,
          view === 'notes' && inferableCount > 0
            ? h(
                'div',
                { className: 'wn-autoBar' },
                h('span', null, fill(t('auto.hint'), { n: inferableCount })),
                h('button', { type: 'button', className: 'wn-dayAdd', onClick: autoSchedule }, t('auto.run')),
              )
            : null,
          view === 'notes'
            ? h('div', { className: 'wn-scroll', ref: scrollRef }, board)
            : view === 'calendar'
              ? h('div', { className: 'wn-scroll' }, calendarView)
              : h(
                  'div',
                  { className: 'wn-ganttPane' },
                  h(
                    'div',
                    { className: 'wn-ganttComposer' },
                    h('input', {
                      className: 'wn-dayInput',
                      value: ganttDraft,
                      placeholder: t('gantt.addPlaceholder'),
                      'aria-label': t('gantt.add'),
                      onChange: (event) => setGanttDraft(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addNoteFromGantt()
                        } else if (event.key === 'Escape') {
                          setGanttDraft('')
                        }
                      },
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'wn-dayAdd',
                        disabled: ganttDraft.trim() === '',
                        onClick: addNoteFromGantt,
                      },
                      t('gantt.add'),
                    ),
                  ),
                  h('div', { className: 'wn-scroll wn-scrollGantt', ref: ganttScrollRef }, ganttView),
                ),
          h(
            'footer',
            { className: 'wn-foot' },
            h('span', null, t('storage.hint')),
            h('span', null, footerHint),
          ),
          picker === null
            ? null
            : (() => {
                const note = notes.find((candidate) => candidate.id === picker.id)
                return note === undefined
                  ? null
                  : h(
                      'div',
                      {
                        className: 'wn-picker',
                        role: 'dialog',
                        'aria-label': t('date.set'),
                        style: { left: `${picker.left}px`, top: `${picker.top}px` },
                      },
                      renderPicker(note),
                    )
              })(),
          monthPicker === null
            ? null
            : h(
                'div',
                {
                  className: 'wn-monthPicker',
                  role: 'dialog',
                  'aria-label': t('month.pick'),
                  style: { left: `${monthPicker.left}px`, top: `${monthPicker.top}px` },
                },
                h(
                  'div',
                  { className: 'wn-pickerHead' },
                  navButton('prev', () => setMonth(shiftMonth(month, -12)), t('calendar.prev'), 'prev-year'),
                  h('span', { className: 'wn-pickerTitle', style: { textAlign: 'center' } }, String(month.year)),
                  navButton('next', () => setMonth(shiftMonth(month, 12)), t('calendar.next'), 'next-year'),
                ),
                h(
                  'div',
                  { className: 'wn-monthGridPicker' },
                  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) =>
                    h(
                      'button',
                      {
                        key: index,
                        type: 'button',
                        className: 'wn-monthCell',
                        'data-active': String(month.month === index),
                        onClick: () => {
                          setMonth({ year: month.year, month: index })
                          setMonthPicker(null)
                        },
                      },
                      fill(t('calendar.monthShort'), { m: index + 1 }),
                    ),
                  ),
                ),
              ),
          helpOpen
            ? h(
                'div',
                {
                  className: 'wn-helpOverlay',
                  onPointerDown: (event) => {
                    if (event.target === event.currentTarget) setHelpOpen(false)
                  },
                },
                h(
                  'div',
                  { className: 'wn-help', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') },
                  h(
                    'div',
                    { className: 'wn-helpHead' },
                    h('span', { className: 'wn-helpTitle' }, t('help.title')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'wn-iconBtn',
                        title: t('help.close'),
                        'aria-label': t('help.close'),
                        onClick: () => setHelpOpen(false),
                      },
                      h('span', { style: { fontSize: '17px', lineHeight: 1 } }, '×'),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'wn-helpBody' },
                    HELP_SECTIONS.map((section) =>
                      h(
                        'section',
                        { key: section, className: 'wn-helpSection' },
                        h('h3', null, t(`help.${section}.title`)),
                        h('p', null, t(`help.${section}.body`)),
                      ),
                    ),
                  ),
                ),
              )
            : null,
        )
      }

      return { NotesPanelIcon, WorkNotesPanel }
    }

    /** Help-panel sections, in reading order; each id owns `help.<id>.title/body`. */
    const HELP_SECTIONS = ['notes', 'date', 'calendar', 'gantt', 'status', 'anno']

    const inject = ['slots', 'locale']

    function apply(ctx) {
      const locale = ctx.locale
      ctx.effect(() => locale.register(NS, DICTIONARIES), 'work-notes: dictionaries')
      ctx.effect(() => installStyles(CSS), 'work-notes: styles')

      const t = makeTranslate(locale)
      const { NotesPanelIcon, WorkNotesPanel } = createComponents(locale)

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, WorkNotesPanel),
      )
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 5,
            label: () => t('panel.title'),
            locale: NS,
          },
          NotesPanelIcon,
        ),
      )
    }

    return { apply, inject }
  },
})
