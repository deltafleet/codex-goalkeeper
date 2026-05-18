# Codex Goalkeeper

長い Codex 作業は、たいてい一気に壊れるわけではありません。

少しずつ方向を失います。

エージェントはまだ自信ありげに話します。テストも実行します。計画も一見もっともらしいままです。しかし compaction、handoff、resume が重なると、いちばん重要な感覚が静かに薄れていきます。

> なぜ、この方針で進んでいたのか？

Codex Goalkeeper は、長い `/goal` 作業が compaction、resume、handoff をまたいでも方向を保てるようにする小さな skill です。

隠れたメモリエンジンを追加するものではありません。エージェントに耐久性のある作業習慣を与えます。

- 短い checkpoint を保つ
- より詳しい context pack を保つ
- 決定と検証を event log に残す
- drift が起きやすい境界の後は、続行前に checkpoint を読む

退屈なファイル。より良い継続性。

[English](README.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md)

## インストール

```bash
npx skills add deltafleet/codex-goalkeeper
```

要件: Node.js 18+ と `npx`。長い goal workflow で、Codex は skill に同梱された Node helper script を使います。

Codex は、リクエストが metadata と強く一致する installed skill を自動で読み込むことがあります。Goalkeeper の metadata は `/goal`、長い作業、compaction、resume、handoff、continuity preservation に反応するように書かれています。

そのため、次のような goal だけで有効になることがあります。

> `/goal` Harden this release over a long-running session. Keep the goal, constraints, rejected paths, failed attempts, verification state, and next action recoverable after compact/resume.

ただし skill activation は routing decision であり、private Codex runtime hook ではありません。Goalkeeper がすべての goal に強制的に自分を適用することはできません。

重要な長期作業では、goal を作る時点、または goal 作成直後で本格作業に入る前に、明示的に呼び出すのがもっとも安全です。

> Use codex-goalkeeper for this `/goal`. Keep the goal, constraints, decisions, verification state, failed attempts, and next action recoverable across compaction.

その後、ユーザーが Goalkeeper の helper script を手で実行する必要はありません。Codex が skill workflow の一部として実行します。

## 問題

短い作業なら、compaction はたいてい大きな問題になりません。エージェントは大まかに復旧できます。

しかし長い goal は違います。

実際のセッションを想像してください。

1. Codex にリリース hardening を任せます。
2. いちばん分かりやすい patch は目の前の bug を直しますが、rollback compatibility を壊す可能性があります。
3. ユーザーは強い制約を置きます。database schema は変更せず、backward compatibility を維持する。
4. 2 回目の試行は unit test を通りますが、integration edge case で失敗します。
5. Codex は compatibility shim と targeted regression test の組み合わせに決めます。
6. regression test が通ります。このルートが安全なルートになります。
7. コンテキストが compact されます。
8. 後でエージェントは「release hardening はほぼ完了」というきれいな要約で戻ってきます。
9. goal は残っています。しかし、なぜ schema shortcut を禁止し続ける必要があるのか、なぜ前の patch が失敗したのか、なぜその regression test が重要なのかは薄れているかもしれません。

ここから drift が始まります。

失敗の原因は「モデルが全部忘れた」ことではありません。もっと厄介です。続けるだけの記憶はあるが、同じ方向で続けるだけの記憶がないのです。

それは次のような形で現れます。

- ユーザーがすでに拒否した方針を再び開く
- 失敗理由が要約から落ち、同じ試行を繰り返す
- 未検証の仮説を確定事実のように扱う
- 長い handoff の後で正確な next action を失う
- goal は残るが運用上の制約を失う
- 説明は滑らかだが実際の作業ストリームからずれる

Goalkeeper は「goal は残っているが、セッションの方向感覚が弱くなった」その隙間を埋めるためのものです。

## Codex がすること

skill が有効になると、Codex はプロジェクト内に継続性フォルダを維持します。

```text
.goalkeeper/
  active-session
  sessions/
    <goal-session-id>/
      checkpoint.md
      context-pack.md
      events.jsonl
```

それぞれの役割は違います。

- `checkpoint.md`: 再開時に最初に読む短い復旧状態
- `context-pack.md`: checkpoint には長すぎるが compaction 後も残すべき判断理由
- `events.jsonl`: 決定、失敗した試行、コマンド根拠、検証、リスク、handoff の記録

Codex の active goal が目的地なら、Goalkeeper はなぜこのルートがまだ正しいのかを保ちます。

## 仕組み

Goalkeeper は長いエージェント作業を単純なループにします。

```text
長い /goal が始まる
  -> Codex が Goalkeeper セッションを作成または再開する
  -> 重要な制約と決定を記録する
  -> 失敗した試行を残し、同じ失敗を繰り返さないようにする
  -> 信頼度が変わる検証根拠を残す
  -> 意味のある境界で checkpoint.md を更新する
  -> context-pack.md が深い判断理由を保つ
  -> resume、handoff、compaction が疑われる後、Codex は checkpoint.md を最初に読む
  -> checkpoint が薄ければ context-pack.md を読む
  -> 正確な証拠が必要なら events.jsonl または source file を確認する
```

これは会話 transcript の保存ではありません。作業状態の保存です。

## あえて小さくしています

このプロジェクトを大きくするのは簡単です。

- daemon
- database
- session rewriter
- private runtime hook
- vector memory layer
- full transcript engine

Goalkeeper は意図的にその方向を避けます。

ファイルを使う理由は、見える、レビューできる、移動しやすい、そして compaction 後にエージェントが読み返しやすいからです。目的は Codex を全知にすることではありません。次の turn を正しい状態から始めることです。

## これは何ではないか

- Codex plugin ではありません。
- MCP server ではありません。
- database ではありません。
- 完全な会話 transcript の保存庫ではありません。
- private Codex runtime hook ではありません。
- 完璧な記憶を保証しません。
- compaction の頻度を下げません。

Goalkeeper は継続性を改善します。コンテキスト制限が消えるふりはしません。

## 何が良くなるか

Goalkeeper を使うと、再開されたセッションが次を復旧できる可能性が上がります。

- ユーザーの non-negotiable constraints
- 現在の実装方向
- 拒否した代替案がなぜ今も拒否されるべきか
- 信頼度を変えたテストやコマンド
- 実際の next action
- 雑に流してはいけない unresolved risks

長いエージェント作業で起きる退屈で高くつく失敗の多くは、これだけでも減らせます。

## リポジトリ構成

```text
src/codex-goalkeeper/       # installable skill payload
  SKILL.md
  agents/openai.yaml
  scripts/
  templates/
  references/
tests/                      # maintainer tests
examples/goalkeeper-session # static example state
docs/                       # roadmap and release policy
```

## Maintainer Validation

リポジトリ maintainer 向けの検証です。

```bash
npm run validate
```

手動では次を実行します。

```bash
find src/codex-goalkeeper/scripts tests -name '*.mjs' -print0 | xargs -0 -n1 node --check
node tests/test-goalkeeper-update-checkpoint.mjs
npx skills add . --list
```

## バージョン管理

Goalkeeper は SemVer を使います。

- Patch: 文書、例、テスト、互換性のあるバグ修正
- Minor: 互換性のある helper または workflow field の追加
- Major: checkpoint、event、script contract の破壊的変更

リリース手順は [docs/RELEASE.md](docs/RELEASE.md) を参照してください。

## コントリビューション

Issue と PR を歓迎します。ただし、このプロジェクトの基準は厳格です。

- core workflow を小さく保つ
- 隠れた runtime dependency を追加しない
- 完璧な復旧を約束しない
- global state より project-local file を優先する
- 変更は検証コマンドで証明する

詳しくは [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md)、[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を参照してください。

## ライセンス

MIT. [LICENSE](LICENSE) を参照してください。
