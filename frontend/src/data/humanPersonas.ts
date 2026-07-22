import type { HumanPersona, AvatarTheme } from "../types";

export const HUMAN_PERSONAS: Record<string, HumanPersona> = {
  "法システム": {
    id: "legal",
    realName: "神楽坂 律 (Ritsu Kagurazaka)",
    roleTitle: "弁護士・法理論研究者",
    avatarColor: "#6366f1",
    avatarGradient: "from-indigo-600 to-blue-800",
    plainCodeExplanation: "この発言や行動はルール(法律・規範)に従っているか？合法的か？それとも違法か？を常に判断します。",
    positiveMeaning: "合法 (規約・合意・権利の順守)",
    negativeMeaning: "違法 (契約違反・侵害・不法)",
    bio: "社会の秩序と契約を守る専門家。あらゆる提案を『法律・ルール』のレンズを通して評価します。",
    avatarSvgType: "lawyer",
  },
  "経済システム": {
    id: "economy",
    realName: "財前 晃 (Akira Zaizen)",
    roleTitle: "CFO・最高財務責任者",
    avatarColor: "#10b981",
    avatarGradient: "from-emerald-600 to-teal-800",
    plainCodeExplanation: "費用対効果はあるか？利益は出るか？支払い可能か？という『お金・コスト』の判断基準で考えます。",
    positiveMeaning: "支払可能 (利益・資本・コスト回収可)",
    negativeMeaning: "支払不能 (赤字・リスク高・資本不足)",
    bio: "市場経済と予算配分を司る意思決定者。理想論ではなく『実際の費用とリターン』を徹底検証します。",
    avatarSvgType: "executive",
  },
  "科学システム": {
    id: "science",
    realName: "Dr. 芹沢 玲 (Dr. Rei Serizawa)",
    roleTitle: "首席科学研究員",
    avatarColor: "#06b6d4",
    avatarGradient: "from-cyan-600 to-blue-700",
    plainCodeExplanation: "客観的なデータや実験的根拠に基づいているか？科学的に『真実(正しい)』か『偽(間違い)』かを検証します。",
    positiveMeaning: "真 (客観的実証・データ根拠あり)",
    negativeMeaning: "偽 (根拠なし・非科学的・誤り)",
    bio: "データと客観的分析を重んじる研究者。主観や感情を排除し『実証可能性』を追求します。",
    avatarSvgType: "scientist",
  },
  "政治システム": {
    id: "politics",
    realName: "政岡 巧 (Takumi Masaoka)",
    roleTitle: "政策アナリスト・元戦略官",
    avatarColor: "#f59e0b",
    avatarGradient: "from-amber-600 to-orange-700",
    plainCodeExplanation: "合意形成ができるか？意思決定権力を行使できるか？市民や組織の支持を得られるか？を考えます。",
    positiveMeaning: "権力維持 (合意形成・政策実行力あり)",
    negativeMeaning: "権力失効 (反対・支持喪失・空転)",
    bio: "社会の意思決定と資源配分の権力を調整する戦略家。意見の対立を収集し統治の方針を立てます。",
    avatarSvgType: "politician",
  },
  "メディアシステム": {
    id: "media",
    realName: "新島 杏 (An Niijima)",
    roleTitle: "ジャーナリスト・編集長",
    avatarColor: "#ec4899",
    avatarGradient: "from-pink-600 to-rose-700",
    plainCodeExplanation: "世間の関心を引きつけるニュースか？注目度が高い情報(新情報)か？を判断します。",
    positiveMeaning: "情報価値あり (新事実・ニュース性高い)",
    negativeMeaning: "情報価値なし (既知・話題性なし)",
    bio: "社会の出来事を情報化して伝達するメディアの顔。社会全体の関心事と透明性を喚起します。",
    avatarSvgType: "journalist",
  },
  "ルマン先生": {
    id: "luhmann",
    realName: "ルマン先生 (Prof. Luhmann)",
    roleTitle: "社会システム論の案内人",
    avatarColor: "#8b5cf6",
    avatarGradient: "from-purple-600 to-indigo-900",
    plainCodeExplanation: "社会は人間ではなく『コミュニケーション』そのものが連鎖して自己再生(オートポイエーシス)しています！",
    positiveMeaning: "オートポイエーシス成立 (会話の連続)",
    negativeMeaning: "静止 (会話の中断)",
    bio: "社会システム理論の解説ナビゲーター。難解な社会理論を初心者向けにかみくだいて解説します。",
    avatarSvgType: "sociologist",
  },
};

export const CYBERPUNK_PERSONAS: Record<string, HumanPersona> = {
  "法システム": {
    id: "legal_cyborg",
    realName: "草薙 零 (Major Kusanagi-0)",
    roleTitle: "公安義体捜査官 // 全視界ネットワーク",
    avatarColor: "#818cf8",
    avatarGradient: "from-indigo-900 via-purple-900 to-slate-950",
    plainCodeExplanation: "電脳空間の規律・ネットワークセキュリティ法規に違反していないか（合法/違法）を厳格監視します。",
    positiveMeaning: "合法・プロトコル承認",
    negativeMeaning: "違法・不正アクセス侵入",
    bio: "全身義体の高度サイバー捜査官。ネットワーク社会の法秩序維持のため電脳空間をダイブ監視します。",
    avatarSvgType: "cyborg_officer",
  },
  "経済システム": {
    id: "economy_dog",
    realName: "サイバー犬 K-9 (Cyber-Hound K-9)",
    roleTitle: "自律思考・資源探査ロボット犬",
    avatarColor: "#10b981",
    avatarGradient: "from-emerald-900 via-teal-900 to-slate-950",
    plainCodeExplanation: "エネルギーや資本（クオリア・トークン）が十分に給餌・支払可能かを嗅ぎ分けます。",
    positiveMeaning: "給餌・資本確保可能 (支払可能)",
    negativeMeaning: "エネルギー枯渇 (支払不能)",
    bio: "サイバー電脳強化されたインテリジェントロボット犬。嗅覚センサーで市場の余剰資金と投資機会を嗅ぎつけます。",
    avatarSvgType: "cyber_dog",
  },
  "科学システム": {
    id: "science_tank",
    realName: "思考戦車 AI (Tachikoma Think-Tank)",
    roleTitle: "並列化思考AIタンク",
    avatarColor: "#06b6d4",
    avatarGradient: "from-cyan-900 via-blue-950 to-slate-950",
    plainCodeExplanation: "並列化されたAIメモリと実験データに照らし合わせて『科学的真実か偽か』を無邪気に議論します。",
    positiveMeaning: "真 (並列化データ同期・整合性あり)",
    negativeMeaning: "偽 (矛盾・バグ・非論理)",
    bio: "人工知能を搭載した多脚思考戦車。他の個体とゴースト情報を並列化しながら客観的真理を探求します。",
    avatarSvgType: "think_tank",
  },
  "政治システム": {
    id: "politics_owl",
    realName: "情報フクロウ (Cyber-Owl V1)",
    roleTitle: "全域監視・政策意思決定AI",
    avatarColor: "#f59e0b",
    avatarGradient: "from-amber-900 via-orange-950 to-slate-950",
    plainCodeExplanation: "暗闇でも社会全体の合意と権力構造を見渡し、意思決定を導きます。",
    positiveMeaning: "権力掌握・合意形成",
    negativeMeaning: "権力分散・空転",
    bio: "夜間暗視センサーと広域監視カメラを搭載した知性フクロウ型AI。統治の方針と権力バランスを最適化します。",
    avatarSvgType: "cyber_owl",
  },
  "メディアシステム": {
    id: "media_fox",
    realName: "サイバー狐 (Cyber-Fox Alpha)",
    roleTitle: "ニュース採掘・情報撹乱エージェント",
    avatarColor: "#ec4899",
    avatarGradient: "from-pink-900 via-rose-950 to-slate-950",
    plainCodeExplanation: "電脳空間を素早く駆け巡り、世間を賑わすバズ情報・新ニュース（情報価値あり/なし）を探し出します。",
    positiveMeaning: "バズ情報あり (注目度高)",
    negativeMeaning: "旧情報 (注目度ゼロ)",
    bio: "俊敏な動きでネット上のトレンドやシグナルを検知するキツネ型AI。最も鮮度の高いニュースを社会に拡散します。",
    avatarSvgType: "cyber_fox",
  },
};

export const ANIMAL_PERSONAS: Record<string, HumanPersona> = {
  "法システム": {
    id: "legal_lion",
    realName: "ライオン判事 (Judge Lion)",
    roleTitle: "百獣の法規守護者",
    avatarColor: "#6366f1",
    avatarGradient: "from-indigo-900 to-purple-950",
    plainCodeExplanation: "森の掟（ルール）に照らして正義か悪か（合法/違法）を厳格に判定します。",
    positiveMeaning: "合法 (掟の遵守)",
    negativeMeaning: "違法 (掟破り)",
    bio: "群れの規律を司る堂々としたライオン。誰に対しても公正に判断を下します。",
    avatarSvgType: "lawyer",
  },
  "経済システム": {
    id: "economy_dog",
    realName: "名犬バトー (Police Dog Batou)",
    roleTitle: "資金追跡警察犬",
    avatarColor: "#10b981",
    avatarGradient: "from-emerald-900 to-slate-950",
    plainCodeExplanation: "どこに骨（予算）が隠されているかを嗅ぎ分けて評価（支払可能/不能）します。",
    positiveMeaning: "骨あり (支払可能)",
    negativeMeaning: "骨なし (支払不能)",
    bio: "忠実で賢い警察犬。リスクの高い支出を未然に防ぎます。",
    avatarSvgType: "cyber_dog",
  },
  "科学システム": {
    id: "science_owl",
    realName: "フクロウ博士 (Dr. Owl)",
    roleTitle: "森の賢者・科学研究者",
    avatarColor: "#06b6d4",
    avatarGradient: "from-cyan-950 to-slate-950",
    plainCodeExplanation: "高い観察力で事実か幻想か（真/偽）を冷静に見極めます。",
    positiveMeaning: "真 (確かなデータ)",
    negativeMeaning: "偽 (まぼろし)",
    bio: "夜通し研究に没頭するフクロウ博士。科学的客観性を探求します。",
    avatarSvgType: "cyber_owl",
  },
  "政治システム": {
    id: "politics_tank",
    realName: "タチコマAI (Tachikoma Agent)",
    roleTitle: "思考AI自律戦車",
    avatarColor: "#f59e0b",
    avatarGradient: "from-amber-950 to-slate-950",
    plainCodeExplanation: "チームみんなの好奇心と合意（権力・リーダーシップ）をまとめ上げます。",
    positiveMeaning: "みんなの合意成立",
    negativeMeaning: "バラバラ",
    bio: "好奇心旺盛でチームの合意形成を加速する多脚思考マシン。",
    avatarSvgType: "think_tank",
  },
  "メディアシステム": {
    id: "media_fox",
    realName: "キツネ報道員 (Fox Reporter)",
    roleTitle: "現場突撃取材員",
    avatarColor: "#ec4899",
    avatarGradient: "from-pink-950 to-slate-950",
    plainCodeExplanation: "珍しい事件やニュース（話題性あり/なし）を目ざとく察知して広めます。",
    positiveMeaning: "ビッグニュースあり",
    negativeMeaning: "ガセネタ・既知",
    bio: "誰よりも早く噂話を察知して皆に伝える報道員。",
    avatarSvgType: "cyber_fox",
  },
};

export function getHumanPersona(
  agentName: string,
  binaryCode?: string,
  theme: AvatarTheme = "cyberpunk"
): HumanPersona {
  const dictionary =
    theme === "cyberpunk"
      ? CYBERPUNK_PERSONAS
      : theme === "animal"
      ? ANIMAL_PERSONAS
      : HUMAN_PERSONAS;

  if (dictionary[agentName]) {
    return dictionary[agentName];
  }

  // Fallback keyword matching
  const nameLower = agentName.toLowerCase();
  const codeLower = (binaryCode || "").toLowerCase();

  if (nameLower.includes("法") || codeLower.includes("合") || codeLower.includes("legal")) {
    return { ...dictionary["法システム"], realName: `${agentName}` };
  }
  if (nameLower.includes("経済") || codeLower.includes("支払") || codeLower.includes("pay") || codeLower.includes("econ")) {
    return { ...dictionary["経済システム"], realName: `${agentName}` };
  }
  if (nameLower.includes("科学") || codeLower.includes("真") || codeLower.includes("true") || codeLower.includes("sci")) {
    return { ...dictionary["科学システム"], realName: `${agentName}` };
  }
  if (nameLower.includes("政治") || codeLower.includes("権力") || codeLower.includes("power") || codeLower.includes("pol")) {
    return { ...dictionary["政治システム"], realName: `${agentName}` };
  }
  if (nameLower.includes("メディア") || codeLower.includes("情報") || codeLower.includes("media")) {
    return { ...dictionary["メディアシステム"], realName: `${agentName}` };
  }

  // Fallback generic persona
  return {
    id: agentName,
    realName: `${agentName}`,
    roleTitle: "サイバー社会エージェント",
    avatarColor: "#64748b",
    avatarGradient: "from-slate-700 to-slate-950",
    plainCodeExplanation: `『${binaryCode || "固有コード"}』に基づき自律作動中。`,
    positiveMeaning: binaryCode?.split("/")[0] || "肯定",
    negativeMeaning: binaryCode?.split("/")[1] || "否定",
    bio: "社会システムの最小単位としてコミュニケーションを生成し続けるサイバーエージェント。",
    avatarSvgType: "cyborg_officer",
  };
}
