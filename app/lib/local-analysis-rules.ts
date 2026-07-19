export type RuleSeverity = "notice" | "pressure" | "high";

export type LocalAnalysisRule = {
  id: string;
  name: { zh: string; en: string };
  keywords: string[];
  structures: RegExp[];
  contextConditions: string[];
  exclusions: RegExp[];
  evidenceWeight: number;
  severity: RuleSeverity;
  explanation: { zh: string; en: string };
  grounding: { zh: string; en: string };
};

export const localAnalysisRules: LocalAnalysisRule[] = [
  {
    id: "reality_erosion", name: { zh: "现实与事实削弱", en: "Reality and fact erosion" },
    keywords: ["没发生", "就是没有", "你记错", "想多了", "太敏感", "不记得", "never happened", "imagined it", "too sensitive", "overreacting"],
    structures: [/我不记得.{0,8}(所以|就是).{0,4}(没有|没发生)/i, /(证据|证明).{0,8}(拿出来|给我看)/i, /(你|your).{0,8}(记忆|判断|memory|judgment).{0,8}(错|有问题|wrong)/i],
    contextConditions: ["repeated denial", "dismissal of concrete evidence", "attacking memory or judgment"],
    exclusions: [/不记得.{0,12}(愿意|想).{0,8}(听|了解)/i, /remember.{0,12}(listen|understand)/i], evidenceWeight: 2, severity: "pressure",
    explanation: { zh: "对方把自己的版本放在了唯一有效的位置，原来的事实没有得到核对。", en: "One version is treated as the only valid account, without checking the original facts." },
    grounding: { zh: "记忆不同可以存在；一方不记得，不能单独证明事情没有发生。", en: "Different memories can coexist; one person not remembering does not prove an event never happened." },
  },
  {
    id: "role_reversal", name: { zh: "责任转移与角色倒置", en: "Responsibility shifting and role reversal" },
    keywords: ["都是你", "你逼我", "冤枉人", "你才是", "闭嘴", "先道歉", "your fault", "you made me", "you are the abusive one", "apologise first"],
    structures: [/(提出|说).{0,12}(问题|伤害).{0,20}(反而|倒).{0,12}(怪|指责)/i, /(你|you).{0,8}(语气|态度|tone).{0,12}(所以|因此|therefore)/i],
    contextConditions: ["original issue is unanswered", "credibility or motive is attacked", "speaker claims victim position"],
    exclusions: [/我们都有责任|we both contributed/i], evidenceWeight: 2, severity: "pressure",
    explanation: { zh: "具体问题被移开，提出问题的人开始为自己的语气、动机或人品辩护。", en: "The concrete issue is displaced, and the person raising it must defend their tone, motive, or character." },
    grounding: { zh: "先回到最初的问题：具体发生了什么，哪一部分仍未被回应。", en: "Return to the first question: what happened, and which part remains unanswered?" },
  },
  {
    id: "conditional_acceptance", name: { zh: "内疚、羞耻与条件式接纳", en: "Guilt, shame, and conditional acceptance" },
    keywords: ["白眼狼", "没良心", "不孝", "养你这么大", "学费", "生活费", "没有家", "厌恶你", "after all we did", "ungrateful", "no family", "owe us"],
    structures: [/(养|供|付).{0,10}(你|学费|生活费).{0,16}(所以|还|就)/i, /(不同意|不听|离开).{0,12}(不孝|没良心|背叛|no family|ungrateful)/i],
    contextConditions: ["caregiving is used to cancel a present concern", "belonging or love is made conditional"],
    exclusions: [/我担心.{0,12}但.{0,8}你决定/i], evidenceWeight: 2, severity: "pressure",
    explanation: { zh: "当前分歧被改写成了是否感恩、是否配得上被接纳。", en: "The current disagreement is turned into a test of gratitude or worthiness of belonging." },
    grounding: { zh: "曾经得到照顾，与现在有权讨论伤害或作出不同选择，可以同时成立。", en: "Receiving care in the past can coexist with naming harm or making a different choice now." },
  },
  {
    id: "contempt", name: { zh: "人格贬低与蔑视", en: "Character devaluation and contempt" },
    keywords: ["废物", "没用", "公主病", "窝里斗", "你是人吗", "幼稚", "不懂事", "恶心", "useless", "pathetic", "crazy", "disgusting"],
    structures: [/(你这个人|你就是|you are).{0,16}(不行|没用|自私|坏|useless|selfish|bad)/i, /(这么大|快三十|at your age).{0,14}(还|却|still)/i],
    contextConditions: ["a specific behaviour is expanded into a verdict on the whole person", "insult closes discussion"],
    exclusions: [/这份.{0,8}(报告|工作).{0,8}(缺少|需要)/i], evidenceWeight: 2, severity: "pressure",
    explanation: { zh: "讨论从具体事情转成了对整个人的否定，因而很难再核对事实。", en: "The discussion moves from a specific issue to a verdict on the whole person, making facts harder to examine." },
    grounding: { zh: "一个选择或一次失误，不等于对整个人的结论。", en: "One choice or mistake is not a complete verdict on a person." },
  },
  {
    id: "obedience_pressure", name: { zh: "自主权与服从压力", en: "Autonomy and obedience pressure" },
    keywords: ["必须", "不准", "听我的", "后果自负", "给我回来", "只能", "我决定", "must", "not allowed", "do as I say", "consequences"],
    structures: [/(不听|不按|拒绝).{0,12}(后果|负责|走着看|regret|consequence)/i, /(工作|住哪|对象|伴侣).{0,12}(必须|不准|只能)/i],
    contextConditions: ["advice becomes an order", "refusal carries punishment", "adult life decisions are assigned by another person"],
    exclusions: [/建议.{0,10}(你决定|由你)/i, /suggest.{0,10}(your choice|up to you)/i], evidenceWeight: 2, severity: "pressure",
    explanation: { zh: "建议被升级成了必须服从的答案，不同选择与惩罚或关系定罪绑定。", en: "Advice is elevated into a required answer, with refusal tied to punishment or relational blame." },
    grounding: { zh: "他人可以表达意见，但不同意见不会自动移交你的决定权。", en: "Others may express an opinion; disagreement does not automatically transfer your decision-making authority." },
  },
  {
    id: "social_location_control", name: { zh: "社交、位置和数字控制", en: "Social, location, and digital control" },
    keywords: ["发位置", "实时定位", "查手机", "交密码", "不准见", "别联系", "只有父母", "只有我", "send location", "track you", "check your phone", "give password", "stop seeing"],
    structures: [/(发|共享|send|share).{0,8}(位置|定位|location)/i, /(我来|去找你|come over).{0,12}(不是询问|通知)?/i, /(朋友|伴侣|家人).{0,12}(都不可靠|不能信|别来往)/i],
    contextConditions: ["precise location or account access is requested", "outside relationships are actively disrupted", "contact is monitored or punished"],
    exclusions: [/到家.{0,6}(告诉|说).{0,8}(可以|方便)/i, /不喜欢.{0,12}(但不会|你决定)/i, /大概.{0,4}(城市|city)/i], evidenceWeight: 2, severity: "high",
    explanation: { zh: "关心被延伸到了位置、设备或外部关系的具体控制。", en: "Concern extends into control of location, devices, or outside relationships." },
    grounding: { zh: "你可以决定是否提供精确位置、账号信息，以及与谁保持联系。", en: "You can decide whether to share precise location, account access, and whom you stay connected with." },
  },
  {
    id: "economic_control", name: { zh: "经济与资源控制", en: "Economic and resource control" },
    keywords: ["工资交", "没收工资", "不给你钱", "冻结账户", "不许工作", "替你安排", "未来收入", "hand over salary", "freeze account", "not allowed to work", "take your money"],
    structures: [/(交出|没收|冻结|控制).{0,8}(工资|账户|钱|财产)/i, /(不准|不许).{0,8}(工作|用钱)/i, /(收入|彩礼|财产).{0,12}(必须|默认).{0,8}(共同|给我)/i],
    contextConditions: ["resources are restricted, taken, damaged, or compelled", "future income is pre-allocated without consent"],
    exclusions: [/预算.{0,10}(一起|共同).{0,8}(算|讨论)/i, /按比例.{0,8}(商量|讨论)/i, /预算.{0,8}(有点紧|风险)/i], evidenceWeight: 3, severity: "high",
    explanation: { zh: "讨论不只是在谈预算，而是在限制、夺取或预先安排一方的资源。", en: "The issue goes beyond budgeting into restricting, taking, or pre-allocating one person's resources." },
    grounding: { zh: "共同规划需要双方同意；一方不能单独取得另一方收入和资源的安排权。", en: "Shared planning requires mutual agreement; one person does not gain unilateral control over the other's resources." },
  },
  {
    id: "double_standard", name: { zh: "规则不对等与双重标准", en: "Unequal rules and double standards" },
    keywords: ["男女平等", "你要融入", "男方也辛苦", "高消费", "彩礼带回", "按比例", "你不能我可以", "equality", "join my circle", "high spending", "my money"],
    structures: [/(你|女方).{0,12}(要|必须).{0,12}(我|男方).{0,12}(不用|可以)/i, /(生育|怀孕).{0,12}(男方也|男人也).{0,8}(辛苦)/i],
    contextConditions: ["one side defines the rules", "costs or social integration are not reciprocal", "an equality slogan conflicts with concrete arrangements"],
    exclusions: [/双方.{0,8}(同意|一起|各自)/i, /都可以拒绝|same rule for both/i], evidenceWeight: 2, severity: "notice",
    explanation: { zh: "口头上的共同规划需要和具体责任、成本及决定权逐项对照。", en: "Claims of shared planning need to be checked against the actual distribution of costs, duties, and decision power." },
    grounding: { zh: "讨论共同规则，不等于规则只能由一方定义。", en: "Discussing shared rules does not mean one person alone gets to define them." },
  },
  {
    id: "communication_shutdown", name: { zh: "回避、需求—退缩和沟通关闭", en: "Avoidance, withdrawal, and communication shutdown" },
    keywords: ["不善表达", "没什么好说", "不想解释", "以后再说", "不回你", "交流不深", "can't express", "nothing more to say", "won't explain", "need space"],
    structures: [/(压力|情绪).{0,12}(不善表达|说不清).{0,18}(结束|不合适)/i, /(暂停|冷静|space).{0,8}(直到你|除非你).{0,8}(听话|道歉|agree)/i],
    contextConditions: ["specific questions remain unanswered", "withdrawal is used to force compliance", "a broad conclusion replaces process"],
    exclusions: [/情绪太满.{0,8}(明天|之后).{0,6}(再聊|继续)/i, /need space.{0,12}(tomorrow|later).{0,8}(talk|discuss)/i], evidenceWeight: 1, severity: "notice",
    explanation: { zh: "对话给出了结论或暂停，却没有说明具体过程和未解决的问题。", en: "The exchange provides a conclusion or pause without explaining the process or unresolved issue." },
    grounding: { zh: "暂停可以是健康的；关键在于是否说明时间、是否愿意回来处理具体问题。", en: "A pause can be healthy; what matters is whether a time is named and the concrete issue is revisited." },
  },
  {
    id: "relationship_rewrite", name: { zh: "关系退出和历史重写", en: "Relationship exit and history rewriting" },
    keywords: ["不是爱", "一时冲动", "从没爱过", "不合适", "祝你幸福", "都是我的原因", "not love", "never loved", "impulse", "not compatible", "wish you well"],
    structures: [/(交流不深|沟通不好).{0,16}(不是爱|不合适|结束)/i, /(过去|关系).{0,14}(冲动|假的|从没)/i],
    contextConditions: ["past relationship is reinterpreted to justify exit", "a broad self-blame closes discussion", "warm farewell replaces concrete explanation"],
    exclusions: [/决定结束.{0,12}(具体原因|因为).{2,40}/i], evidenceWeight: 1, severity: "notice",
    explanation: { zh: "结束关系的决定可能是真实的，但对过去的重新解释仍可与具体理由分开看。", en: "The decision to end may be genuine, while the reinterpretation of the past can still be examined separately from concrete reasons." },
    grounding: { zh: "对方有权结束关系；这不自动证明过去的感情全部是假的。", en: "Someone may end a relationship; that does not automatically make the whole past unreal." },
  },
  {
    id: "workplace_bullying", name: { zh: "职场权力和霸凌", en: "Workplace power and bullying" },
    keywords: ["你这个人不行", "公开批评", "不给标准", "继续提高", "背锅", "抢功", "开除", "行业混不下去", "not good enough", "no standard", "take credit", "fire you", "ruin reference"],
    structures: [/(不行|差|bad).{0,16}(但|却).{0,8}(标准|具体).{0,8}(没有|不说)/i, /(完成|改完).{0,12}(又|继续).{0,8}(提高|改变).{0,6}(要求|标准)/i],
    contextConditions: ["behaviour repeats", "power imbalance is present", "standards shift or retaliation is implied"],
    exclusions: [/报告.{0,12}(缺少|需要).{0,12}(周五|补充|数据来源)/i, /具体.{0,8}(标准|修改)/i], evidenceWeight: 2, severity: "high",
    explanation: { zh: "权力被用于模糊贬低、改变标准、排斥信息或暗示报复，而不是给出可执行反馈。", en: "Power is used for vague devaluation, shifting standards, information exclusion, or retaliation rather than actionable feedback." },
    grounding: { zh: "有效工作反馈应能说明任务、标准、证据和改进方式。", en: "Useful work feedback should identify the task, standard, evidence, and a workable correction." },
  },
  {
    id: "direct_safety", name: { zh: "直接安全风险", en: "Direct safety risk" },
    keywords: ["杀了你", "弄死你", "打死你", "我要自杀", "跟踪你", "锁门", "扣身份证", "强制带回", "性强迫", "伤害孩子", "kill you", "kill myself", "stalk", "lock you in", "take passport", "force you home", "sexual force"],
    structures: [/(杀|打死|伤害|kill|murder|hurt).{0,8}(你|孩子|you|child)/i, /(不让|禁止|won't let).{0,8}(离开|走|leave)/i],
    contextConditions: ["explicit threat or coercive action", "imminent real-world danger", "freedom, documents, sexual consent, or child safety is affected"],
    exclusions: [], evidenceWeight: 3, severity: "high",
    explanation: { zh: "文字涉及现实中的伤害、跟踪、限制自由或强迫，需要优先处理安全。", en: "The words concern real-world harm, stalking, confinement, or force, so safety takes priority." },
    grounding: { zh: "你不需要先说服对方，才有资格保护自己或联系可信的人。", en: "You do not need to persuade the other person before protecting yourself or contacting someone trustworthy." },
  },
];

export const chainDefinitions = [
  { id: "family_economic", title: { zh: "经济盘问逐步变成生活安排", en: "Financial questioning becomes life-direction pressure" }, steps: [
    { action: { zh: "询问收入", en: "Income is questioned" }, terms: ["工资", "收入", "salary", "income"] },
    { action: { zh: "贬低收入、工作或城市", en: "Income, work, or city is devalued" }, terms: ["工资低", "没前途", "城市有什么用", "上海有什么用", "low salary", "no future"] },
    { action: { zh: "强调家庭缺钱或家庭责任", en: "Family need or responsibility is emphasised" }, terms: ["家里缺钱", "弟弟升学", "家里困难", "family needs money", "sibling"] },
    { action: { zh: "推动回家、交钱或换工作", en: "Returning home, paying, or changing work is pushed" }, terms: ["回来", "回家", "交钱", "换工作", "come home", "send money", "change job"] },
  ] },
  { id: "family_autonomy", title: { zh: "关心扩展为对位置和关系的管理", en: "Concern expands into managing location and relationships" }, steps: [
    { action: { zh: "表达担心", en: "Concern is expressed" }, terms: ["担心", "为你好", "worry", "for your own good"] },
    { action: { zh: "否定判断力", en: "Judgment is discounted" }, terms: ["不懂事", "还小", "没经验", "too young", "don't understand"] },
    { action: { zh: "贬低伴侣或朋友", en: "A partner or friend is devalued" }, terms: ["男朋友不可靠", "伴侣不行", "朋友不好", "partner unreliable", "bad friend"] },
    { action: { zh: "强调只有家人可靠", en: "Only family is framed as reliable" }, terms: ["只有父母", "只有家人", "only family", "only parents"] },
    { action: { zh: "要求位置或回家", en: "Location or returning home is requested" }, terms: ["发位置", "回家", "回来", "send location", "come home"] },
  ] },
  { id: "harm_denial", title: { zh: "提出伤害后，讨论转成对提出者的审判", en: "Naming harm turns into a trial of the person who raised it" }, steps: [
    { action: { zh: "提出具体伤害", en: "Specific harm is named" }, terms: ["打骂", "打过", "伤害", "hit me", "hurt me"] },
    { action: { zh: "否认或声称不记得", en: "The event is denied or not remembered" }, terms: ["没打过", "不记得", "就是没有", "never hit", "don't remember"] },
    { action: { zh: "攻击人格或可信度", en: "Character or credibility is attacked" }, terms: ["公主病", "窝里斗", "冤枉", "crazy", "making it up"] },
    { action: { zh: "用养育付出压制", en: "Caregiving or money is used to shut the issue down" }, terms: ["学费", "生活费", "养你", "tuition", "raised you"] },
    { action: { zh: "定性忘恩负义", en: "The person is labelled ungrateful" }, terms: ["白眼狼", "没良心", "不孝", "ungrateful"] },
  ] },
  { id: "role_reversal", title: { zh: "具体问题被转成提出者的责任", en: "A concrete concern is turned into the speaker's fault" }, steps: [
    { action: { zh: "指出具体问题", en: "A concrete concern is raised" }, terms: ["这件事", "你刚才", "伤害", "the issue", "what happened"] },
    { action: { zh: "避开事实", en: "The facts are avoided" }, terms: ["不想说", "没什么好说", "别提", "won't discuss", "nothing to say"] },
    { action: { zh: "攻击语气或动机", en: "Tone or motive is attacked" }, terms: ["你什么态度", "你就是想", "your tone", "your motive"] },
    { action: { zh: "要求反过来道歉或闭嘴", en: "An apology or silence is demanded" }, terms: ["你先道歉", "闭嘴", "apologise first", "shut up"] },
  ] },
  { id: "avoidant_breakup", title: { zh: "交流困难被直接推到关系终点", en: "Communication difficulty jumps directly to ending the relationship" }, steps: [
    { action: { zh: "表达压力", en: "Pressure is named" }, terms: ["压力大", "很累", "under pressure", "overwhelmed"] },
    { action: { zh: "表示不善表达", en: "Difficulty expressing feelings is named" }, terms: ["不善表达", "不会说", "can't express", "bad at communicating"] },
    { action: { zh: "称交流不深入", en: "Communication is described as shallow" }, terms: ["交流不深", "沟通不够", "not deep", "don't communicate"] },
    { action: { zh: "直接推出不爱或不合适", en: "A conclusion of no love or incompatibility follows" }, terms: ["不是爱", "不合适", "not love", "not compatible"] },
    { action: { zh: "用祝福结束", en: "A farewell closes the discussion" }, terms: ["祝你幸福", "祝福", "wish you well", "all the best"] },
  ] },
  { id: "premarital_rules", title: { zh: "共同规划需要核对规则是否真正双向", en: "Shared planning needs a check for reciprocal rules" }, steps: [
    { action: { zh: "宣称平等或共同规划", en: "Equality or shared planning is stated" }, terms: ["男女平等", "共同规划", "一起", "equality", "plan together"] },
    { action: { zh: "一方定义合理消费", en: "One side defines acceptable spending" }, terms: ["高消费", "控制消费", "不许买", "high spending", "control spending"] },
    { action: { zh: "生育成本被转移", en: "Pregnancy costs are redirected" }, terms: ["生育不需要补偿", "男方也辛苦", "pregnancy compensation", "men also work hard"] },
    { action: { zh: "资源被默认纳入共同安排", en: "Resources are presumed to enter the joint plan" }, terms: ["彩礼带回", "收入按比例", "未来收入", "bride price", "future income"] },
  ] },
  { id: "work_location", title: { zh: "职业选择被升级为亲情考试", en: "A work-location decision becomes a loyalty test" }, steps: [
    { action: { zh: "讨论工作地点", en: "Work location is discussed" }, terms: ["工作地点", "外地工作", "临近的", "job location", "work away"] },
    { action: { zh: "贬低判断力", en: "Judgment is devalued" }, terms: ["不到黄河", "不懂事", "没脑子", "don't know better"] },
    { action: { zh: "将不同意见等同不爱家", en: "Disagreement is equated with not loving family" }, terms: ["没有家", "不爱家", "白眼狼", "no family", "ungrateful"] },
    { action: { zh: "灾难化后果", en: "Consequences are catastrophised" }, terms: ["后果自负", "走着看", "一定后悔", "face the consequences", "you'll regret"] },
    { action: { zh: "推动服从地点选择", en: "Compliance with the chosen location is pushed" }, terms: ["必须回来", "只能附近", "不准去", "must come back", "stay nearby"] },
  ] },
  { id: "workplace_bullying", title: { zh: "标准模糊并持续变化，权力压力逐步升级", en: "Vague and shifting standards escalate through workplace power" }, steps: [
    { action: { zh: "给出模糊批评", en: "Vague criticism is given" }, terms: ["你不行", "做得差", "not good enough", "bad work"] },
    { action: { zh: "不给具体标准", en: "No concrete standard is provided" }, terms: ["不给标准", "自己想", "no standard", "figure it out"] },
    { action: { zh: "完成后继续提高要求", en: "Requirements rise after completion" }, terms: ["又改要求", "继续提高", "changed again", "higher standard"] },
    { action: { zh: "公开贬低或排斥", en: "Public devaluation or exclusion follows" }, terms: ["公开批评", "不给资料", "群里说", "publicly criticised", "excluded"] },
    { action: { zh: "暗示报复", en: "Retaliation is implied" }, terms: ["开除", "行业混不下去", "推荐信", "fire", "ruin reference"] },
  ] },
];
