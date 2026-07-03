// Best-effort, heuristic hints inferred from a crashed launch's console
// output. These substrings are a starting set based on common GZDoom/ZDoom
// console phrasing — not verified against every source port/version, so
// hints are hedged ("likely," "may") rather than asserted as fact. A
// wrong/missing hint just falls back to "see the log below"; a confidently
// wrong one would be worse than none.

interface CrashHintRule {
  pattern: RegExp
  hint: string
}

const RULES: CrashHintRule[] = [
  {
    pattern: /cannot find (a game )?iwad|could not find iwad/i,
    hint: "Couldn't find the IWAD. It may have been moved, renamed, or deleted — check Settings → Paths."
  },
  {
    pattern: /unable to open|could not open|no such file/i,
    hint: "One of this protocol's mod files couldn't be opened — it may have been moved or deleted. Check the Mod Files list."
  },
  {
    pattern: /script error/i,
    hint: 'One of the loaded mods has a script error (DECORATE/ZScript) — likely a mod incompatibility, or a mod that needs a different source port version.'
  },
  {
    pattern: /vm execution aborted/i,
    hint: "A mod's script crashed at runtime. Usually a mod incompatibility, or a mod requiring a newer/older engine version."
  },
  {
    pattern: /checksum|wrong version|incompatible/i,
    hint: "A loaded file may be the wrong version for this protocol's mods."
  }
]

export function inferCrashHint(logTail: string[]): string | null {
  const text = logTail.join('\n')
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.hint
  }
  return null
}
