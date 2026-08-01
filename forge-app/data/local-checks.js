// =============================================================================
//  THE FORGE — local grading specs, one per step
//
//  These are the rubrics in quests.js rewritten as something a computer can
//  actually check, so grading needs no AI key at all. Kept in their own file
//  because they change for a different reason than the lesson text does: the
//  teaching is content, this is assessment.
//
//  Per step:
//    concepts  groups of synonyms. A group "hits" if ANY of its terms appears.
//              Terms are matched as substrings of the normalised answer, so
//              "expect" covers expects/expected/expectations — keep them SHORT
//              and stemmed for that reason.
//    min       how many groups must hit. Defaults to all of them. Use it where
//              the rubric says "one of", or where a kid can reasonably express
//              the idea while skipping a synonym we didn't think of.
//    items     require N distinct list entries (for "name three tools",
//              "3 game ideas"). Counted by listItems() in server.js.
//    minWords  effort floor. Defaults to a value derived from the step's XP.
//
//  A step with no entry here falls back to effort + own-words checks only,
//  which is still better than the old word-count grader.
// =============================================================================

module.exports = {
  // ---- Act 0 — setup --------------------------------------------------------
  q0key: {
    concepts: [
      ['browser', 'device', 'my computer', 'locally', 'this page', 'my machine'],
      ['git', 'commit', 'chat', 'screenshot', 'share', 'post', 'public', 'rotat', 'revoke', '.env', 'env file'],
    ],
    minWords: 20,
  },
  // The rubric names the valid tools outright, so check for those rather than
  // counting list entries — it's the same question asked precisely.
  q0s1: {
    concepts: [
      ['claude'],
      ['ai studio', 'gemini', 'google ai'],
      ['vs code', 'vscode', 'visual studio'],
      ['python'],
      ['git', 'github'],
      ['phaser'],
    ],
    min: 3,
    minWords: 20,
  },
  q0s2: {
    concepts: [['vanguard', 'bard', 'artificer', 'engine', 'spellblade']],
    minWords: 15,
  },

  // ---- Act 1 — prompting ----------------------------------------------------
  q1race: {
    concepts: [['role'], ['action', 'task', 'do'], ['context', 'background', 'info', 'detail'], ['expect', 'format', 'output', 'shape']],
    minWords: 25,
  },
  q1s1: {
    concepts: [
      ['you are', 'act as', 'role of', 'as a', "you're a", 'your persona'],
      ['brainstorm', 'generate', 'list', 'write', 'come up', 'give me', 'suggest'],
      ['phaser', 'browser', '2d', 'crew', 'teen', 'beginner', 'javascript'],
      ['numbered', 'bullet', 'one line', 'each', 'format', 'sentence', 'list of', 'plan', 'detail', 'thought out', 'include', 'i want', 'music', 'full'],
    ],
    minWords: 30,
  },
  q1s2: { items: 3, minWords: 15 },
  q2sys: {
    concepts: [['system'], ['user'], ['example', 'e.g', 'for instance', 'such as', 'like']],
    minWords: 25,
  },
  q2s1: {
    concepts: [
      ['you are', 'act as', 'role of', "you're", 'your job', 'persona'],
      ['critic', 'critique', 'review', 'feedback', 'flaw', 'judge', 'design'],
      ['only', 'must', 'never', 'always', "don't", 'do not', 'no fluff', 'focus', 'format', 'keep it', 'avoid'],
    ],
    minWords: 30,
  },

  // ---- Act 2 — agents, tools, MCP -------------------------------------------
  q3loop: {
    concepts: [['think', 'decide', 'plan', 'reason'], ['act', 'action', 'tool', 'do'], ['observe', 'read', 'result', 'watch', 'see', 'check'], ['loop', 'repeat', 'again', 'cycle', 'until']],
    min: 3,
    minWords: 25,
  },
  q3s1: {
    concepts: [['tool', 'action', 'act', 'do something', 'does something', 'perform', 'interact', 'carry out'],
               ['chatbot', 'chat bot', 'only talk', 'just talk', 'just respond', 'only respond', 'responding']],
    minWords: 30,
  },
  q4what: {
    concepts: [['name', 'identifier', 'called', 'id'], ['input', 'argument', 'parameter', 'request', 'call', 'give it'], ['output', 'return', 'result', 'answer', 'back']],
    minWords: 20,
  },
  q4s1: {
    // No group for "has a name": naming a tool is done by naming it, which no
    // keyword can see. Input and output are the checkable halves.
    concepts: [['input', 'argument', 'parameter', 'takes', 'give', 'call'], ['output', 'return', 'result', 'gives back', 'gives', 'answer']],
    minWords: 30,
  },
  q5what: {
    concepts: [['standard', 'protocol', 'usb', 'universal', 'adapter', 'common', 'connector', 'connection'], ['tool', 'data', 'app', 'server', 'file', 'agent']],
    minWords: 20,
  },
  q5s1: {
    concepts: [['repo', 'file', 'folder', 'codebase', 'project', 'directory', 'github', 'data', 'database', 'api', 'playtime', 'collect']],
    minWords: 25,
  },

  // ---- Act 3 — building -----------------------------------------------------
  q6scope: {
    concepts: [['core loop', 'loop', 'repeat', 'over and over', 'again and again', 'core action'], ['small', 'finish', 'v1', 'cut', 'minimal', 'simple', 'scope', 'done']],
    minWords: 25,
  },
  q6s1: {
    concepts: [['loop', 'repeat', 'core', 'player does', 'gameplay'], ['cut', 'skip', 'drop', 'no ', 'without', 'leave out', 'later', 'v2', 'not doing']],
    minWords: 30,
  },
  q7rule: {
    concepts: [['one', 'single', 'small', 'little'], ['review', 'debug', 'track', 'trace', 'find', 'check', 'monitor', 'see what', 'know what']],
    minWords: 20,
  },
  q7s1: {
    concepts: [
      ['one', 'single', 'only', 'just'],
      ['file', 'folder', 'line', 'function', 'env', 'code'],
      ['show', 'explain', 'tell me', 'afterward', 'after', 'return', 'diff', 'changed'],
    ],
    min: 2,
    minWords: 25,
  },

  // ---- Act 4 — getting unstuck ----------------------------------------------
  q8ask: {
    concepts: [['doing', 'trying', 'ran', 'was'], ['error', 'message', 'output', 'log', 'traceback'], ['why', 'explain', 'understand', 'cause', 'reason']],
    min: 2,
    minWords: 20,
  },
  q8s1: {
    concepts: [['error', 'message', 'log', 'traceback'], ['why', 'explain', 'cause', 'reason']],
    minWords: 25,
  },
  q8s2: {
    concepts: [['branch', 'checkout', 'switch'], ['add', 'stage'], ['commit'], ['push']],
    min: 3,
    minWords: 12,
  },

  // ---- Act 5 — swarms & orchestration ---------------------------------------
  q9what: {
    concepts: [['multiple', 'several', 'many', 'more than one', 'lots of', 'group', 'team'], ['handoff', 'hand off', 'output', 'input', 'pass', 'next', 'pipeline', 'chain']],
    minWords: 25,
  },
  q9s1: { items: 3, concepts: [['handoff', 'hand off', 'output', 'input', 'pass', 'next', 'pipeline', 'then', 'feeds']], minWords: 30 },
  q10what: {
    concepts: [['vague', 'unclear', 'broad', 'fuzzy', 'general'], ['concrete', 'specific', 'clear', 'next step', 'startable', 'actionable'], ['owner', 'who', 'assign', 'responsible']],
    min: 2,
    minWords: 25,
  },
  q10s1: { items: 3, concepts: [['owner', 'who', 'assign', 'zeppelin', 'leo', 'jonah', 'jyana']], minWords: 30 },

  // ---- Act 6 — security -----------------------------------------------------
  q11learn: {
    concepts: [['.env', 'env file', 'env'], ['gitignore', 'git ignore', 'ignore'], ['secret', 'key', 'password', 'token', 'credential']],
    min: 2,
    minWords: 20,
  },
  q11s1: {
    concepts: [
      ['commit', 'git', 'push', 'repo'],
      ['chat', 'screenshot', 'paste', 'share', 'post', 'public'],
      ['.env', 'env file', 'gitignore', 'ignore'],
      ['rotat', 'revoke', 'regenerate', 'new key', 'delete'],
    ],
    min: 3,
    minWords: 30,
  },
  q12learn: {
    concepts: [['hidden', 'hide', 'inside', 'embed', 'buried', 'within', 'planted'], ['instruction', 'command', 'prompt', 'tell', 'order'], ['data', 'text', 'page', 'file', 'website', 'tool', 'result', 'comment', 'email']],
    min: 2,
    minWords: 25,
  },
  q12s1: {
    concepts: [
      ['hidden', 'hide', 'inside', 'embed', 'buried', 'planted', 'within'],
      ['separate', 'trust', 'untrusted', 'validate', 'sanitize', 'confirm', 'approve', 'check', 'block', 'never auto', 'permission'],
    ],
    minWords: 30,
  },

  // ---- Act 7 — audits & polish ----------------------------------------------
  q13learn: {
    concepts: [['criteria', 'criterion', 'rule', 'standard', 'checklist'], ['threshold', 'pass', 'fail', 'score', 'cutoff', 'bar'], ['measur', 'objective', 'checkable', 'countable', 'specific', 'number']],
    min: 2,
    minWords: 20,
  },
  q13s1: { items: 3, concepts: [['pass', 'fail', 'threshold', 'score', 'under', 'over', 'more than', 'less than', 'at least', 'within']], minWords: 30 },
  q14learn: {
    concepts: [['silent', 'quiet', 'say nothing', "don't help", 'do not help', 'not helping', 'watch', 'observe'], ['confus', 'bored', 'stuck', 'lost', 'frustrat']],
    minWords: 20,
  },
  q14s1: {
    concepts: [
      ['silent', 'quiet', 'say nothing', "don't help", 'do not help', 'watch', 'observe'],
      ['confus', 'bored', 'stuck', 'lost', 'frustrat'],
      ['fix', 'change', 'add', 'move', 'adjust', 'tweak', 'instead'],
    ],
    min: 2,
    minWords: 30,
  },
  q15learn: {
    concepts: [['hook', 'grab', 'excit', 'fun', 'catch', 'lead with'], ['feature', 'list', 'boring', 'dry', 'spec', 'dull']],
    minWords: 20,
  },
  q15s1: { minWords: 25 },
  q16s1: {
    concepts: [['learn', 'took away', 'realis', 'realiz', 'understood', 'now i know', 'taught'], ['next', 'going to', 'will use', 'plan', 'future', 'from now']],
    minWords: 40,
  },
};
