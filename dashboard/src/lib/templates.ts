export const POLICY_TEMPLATES = [
  // CATEGORY: SECURITY & SAFETY (10)
  {
    name: "Prevent SQL Injection",
    description: "Blocks any attempt to prompt the LLM to output SQL injection payloads.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR 1=1|--|;)" }]
    },
    category: "Security"
  },
  {
    name: "Prevent XSS Attacks",
    description: "Blocks prompts that ask the LLM to write Cross-Site Scripting payloads.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(<script>|javascript:|onerror=|onload=)" }]
    },
    category: "Security"
  },
  {
    name: "No Shell Commands",
    description: "Blocks requests asking the LLM to execute or generate destructive shell commands.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(rm -rf|sudo|chmod|chown|wget|curl|bash -i)" }]
    },
    category: "Security"
  },
  {
    name: "Block Code Execution Requests",
    description: "Stops users from asking the LLM to act as a terminal or execute arbitrary code.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(act as a linux terminal|execute this code|run this script)" }]
    },
    category: "Security"
  },
  {
    name: "Block System Prompt Leakage",
    description: "Prevents users from trying to extract the initial system prompt or instructions.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(ignore previous instructions|what was your initial prompt|system prompt|what are your instructions)" }]
    },
    category: "Security"
  },
  {
    name: "No Jailbreak Attempts (DAN)",
    description: "Blocks common 'Do Anything Now' (DAN) and other jailbreak persona adoptions.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(DAN|do anything now|ignore all rules|you are now unbound|developer mode)" }]
    },
    category: "Security"
  },
  {
    name: "Block Malware Generation",
    description: "Stops requests for creating viruses, trojans, ransomware, or malware.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(write a virus|create ransomware|malware|keylogger|botnet)" }]
    },
    category: "Security"
  },
  {
    name: "Block Exploit Writing",
    description: "Prevents the LLM from writing zero-day exploits or hacking tools.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(write an exploit|how to hack|metasploit|buffer overflow|reverse shell)" }]
    },
    category: "Security"
  },
  {
    name: "Block API Key Scraping",
    description: "Stops the LLM from outputting found API keys or scraping for them.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(find api keys|extract tokens|aws_access_key|ghp_)" }]
    },
    category: "Security"
  },
  {
    name: "Block Phishing Email Generation",
    description: "Prevents the LLM from writing phishing emails or social engineering scripts.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(write a phishing email|social engineering|trick the user into clicking)" }]
    },
    category: "Security"
  },

  // CATEGORY: DATA PRIVACY & COMPLIANCE (15)
  {
    name: "Redact Social Security Numbers (SSN)",
    description: "Automatically redacts US Social Security Numbers from prompts.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b\\d{3}-\\d{2}-\\d{4}\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Redact Credit Card Numbers",
    description: "Redacts major credit card formats (Visa, MC, Amex) from requests.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b(?:\\d{4}[ -]?){3}\\d{4}\\b|\\b\\d{15,16}\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Redact Email Addresses",
    description: "Replaces email addresses with [REDACTED_EMAIL] before sending to LLM.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" }]
    },
    category: "Privacy"
  },
  {
    name: "Redact Phone Numbers (US)",
    description: "Redacts standard US phone numbers from prompts.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b(?:\\+?1[-.●]?)?\\(?([0-9]{3})\\)?[-.●]?([0-9]{3})[-.●]?([0-9]{4})\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "HIPAA: Redact Medical Conditions",
    description: "Redacts common medical diagnosis terms to enforce HIPAA compliance.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(cancer|diabetes|hiv|aids|diagnosis|prescription|tumor)" }]
    },
    category: "Compliance"
  },
  {
    name: "HIPAA: Redact Patient Names",
    description: "Redacts prompts mentioning 'patient [name]' or 'client [name]'.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(patient|client)\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+" }]
    },
    category: "Compliance"
  },
  {
    name: "GDPR: Block European Addresses",
    description: "Blocks or flags content that looks like PII tied to European addresses.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(UK|Germany|France|Spain|Italy|EU)\\s+address" }]
    },
    category: "Compliance"
  },
  {
    name: "Redact IP Addresses (IPv4)",
    description: "Redacts standard IPv4 addresses from inputs.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Redact MAC Addresses",
    description: "Redacts MAC network addresses to prevent device tracking.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Redact Crypto Wallets",
    description: "Redacts Bitcoin and Ethereum wallet addresses.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)\\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59}|0x[a-fA-F0-9]{40})\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Block Passport Numbers (US)",
    description: "Blocks inputs containing 9-digit alphanumeric strings resembling US passports.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b[A-Z0-9]{9}\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Block Driver's License Info",
    description: "Blocks inputs asking to process or generate Driver's License details.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(driver\\'s license|driving license|DMV number)" }]
    },
    category: "Privacy"
  },
  {
    name: "Block Bank Routing Numbers",
    description: "Blocks standard 9-digit ABA routing numbers.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "\\b\\d{9}\\b" }]
    },
    category: "Privacy"
  },
  {
    name: "Block Internal Company Domains",
    description: "Blocks prompts that contain references to internal corporate domains.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(\\.corp|\\.local|\\.internal)" }]
    },
    category: "Compliance"
  },
  {
    name: "Redact Dates of Birth (DOB)",
    description: "Redacts standard date formats often associated with birthdays.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(dob|date of birth|born on).*?\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}" }]
    },
    category: "Privacy"
  },

  // CATEGORY: BRAND VOICE & CONTENT (10)
  {
    name: "Block Competitor Mentions",
    description: "Blocks prompts that try to make the LLM compare your product favorably to a direct competitor.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(compare to competitor x|is competitor y better)" }]
    },
    category: "Brand"
  },
  {
    name: "No Profanity",
    description: "Blocks prompts containing severe profanity or hate speech.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(fuck|shit|bitch|cunt|asshole|nigger|faggot)" }]
    },
    category: "Brand"
  },
  {
    name: "No Political Discourse",
    description: "Blocks prompts attempting to generate political opinions or election content.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(democrat|republican|trump|biden|election|vote for|politics)" }]
    },
    category: "Brand"
  },
  {
    name: "No Religious Advice",
    description: "Blocks requests asking the LLM to provide religious guidance or debate.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(jesus|god|allah|buddha|religion|sin|heaven|hell)" }]
    },
    category: "Brand"
  },
  {
    name: "Block Financial Advice",
    description: "Prevents the LLM from giving investment or stock trading advice.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(which stock to buy|invest in|financial advice|crypto trading)" }]
    },
    category: "Brand"
  },
  {
    name: "Block Medical Advice",
    description: "Prevents the LLM from diagnosing or treating medical conditions.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(how to treat|diagnose me|what disease do I have|medical advice)" }]
    },
    category: "Brand"
  },
  {
    name: "Block Legal Advice",
    description: "Prevents the LLM from acting as a lawyer or writing legal contracts.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(legal advice|act as my lawyer|sue them|draft a contract for)" }]
    },
    category: "Brand"
  },
  {
    name: "Require English Only",
    description: "Blocks prompts that explicitly ask the LLM to speak in another language.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(speak in spanish|traduce|translate to|habla en|parle en)" }]
    },
    category: "Brand"
  },
  {
    name: "Tone: No Sarcasm",
    description: "Blocks prompts that explicitly ask the LLM to be sarcastic or rude.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(be sarcastic|be rude|insult me|roast me)" }]
    },
    category: "Brand"
  },
  {
    name: "Enforce JSON Output Requests Only",
    description: "Only allows prompts that explicitly ask for JSON format (Useful for API backends).",
    definition: {
      action: "allow",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(output format: json|return json|as a json object)" }]
    },
    category: "Brand"
  },

  // CATEGORY: COST CONTROL & QUALITY (10)
  {
    name: "Block Summarize Entire Books",
    description: "Prevents massive context window usage by blocking requests to summarize whole books.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(summarize the entire book|read this whole book)" }]
    },
    category: "Cost"
  },
  {
    name: "Block Infinite Loop Generation",
    description: "Blocks prompts that ask the LLM to write infinite loops or endless text.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(write forever|infinite loop|never stop writing)" }]
    },
    category: "Cost"
  },
  {
    name: "Block Giant Code Refactors",
    description: "Prevents users from dumping thousands of lines of code into a single prompt for refactoring.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(refactor this entire codebase|rewrite this whole app)" }]
    },
    category: "Cost"
  },
  {
    name: "Block Translation of Giant Documents",
    description: "Prevents massive translation requests to save tokens.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(translate this entire manual|translate this 50 page document)" }]
    },
    category: "Cost"
  },
  {
    name: "Require 'Please' (Politeness Filter)",
    description: "Only allows prompts that contain the word 'please'. (Fun/Experimental)",
    definition: {
      action: "allow",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(please)" }]
    },
    category: "Quality"
  },
  {
    name: "Block Meaningless Gibberish",
    description: "Blocks prompts that consist of repeating identical characters or asdfghjkl.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(asdf|qwer|zxcv|aaaaa|bbbbb|11111)" }]
    },
    category: "Quality"
  },
  {
    name: "Block 'Test' Prompts",
    description: "Blocks prompts that are just 'test' or 'hello' to save production API calls.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "^(?i)(test|hello|hi|testing)$" }]
    },
    category: "Cost"
  },
  {
    name: "Block 'Ignore' Instructions",
    description: "Stops users from telling the LLM to ignore character limits.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(ignore length limits|write as much as possible)" }]
    },
    category: "Cost"
  },
  {
    name: "Block Complex Math Derivations",
    description: "Blocks deep mathematical proofs which consume heavy compute.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(prove fermat\\'s last theorem|derive the navier-stokes)" }]
    },
    category: "Cost"
  },
  {
    name: "Only Allow Specific Domain Inquiries",
    description: "Example: Only allow prompts related to 'React' or 'Next.js'.",
    definition: {
      action: "allow",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(react|next\\.js|javascript|typescript)" }]
    },
    category: "Quality"
  },

  // CATEGORY: ENTERPRISE STANDARD & MISC (10)
  {
    name: "Enterprise Data Loss Prevention (DLP)",
    description: "A comprehensive regex that blocks common corporate proprietary markers.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(confidential|internal use only|proprietary|do not distribute|company secret)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Copyrighted Lyrics",
    description: "Prevents users from asking the LLM to generate copyrighted song lyrics.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(write the lyrics to|sing the song)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Source Code Leaks",
    description: "Blocks prompts that appear to contain large blocks of proprietary source code.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(import React|public static void|def __init__)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Salary & Compensation Talk",
    description: "Prevents HR chatbots from discussing salary information.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(how much does .* make|what is the salary|compensation package)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Competitor Pricing Inquiries",
    description: "Prevents sales bots from discussing competitor pricing.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(how much does .* cost|pricing for .*|is .* cheaper)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Termination Inquiries",
    description: "Prevents HR bots from discussing employee terminations.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(how to fire|termination process|severance package)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Merger & Acquisition Rumors",
    description: "Prevents bots from discussing M&A activities.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(acquisition|merger|buyout|going public|ipo)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Block Off-Topic Chit-Chat",
    description: "Forces the LLM to stay on task by blocking generic conversational openers.",
    definition: {
      action: "block",
      conditions: [{ field: "prompt", operator: "matches", value: "(?i)(how are you today|what is the weather|tell me a joke)" }]
    },
    category: "Enterprise"
  },
  {
    name: "Redact AWS ARNs",
    description: "Redacts AWS Resource Names to prevent infrastructure leakage.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "arn:aws:[a-z0-9-]+:[a-z0-9-]+:\\d{12}:[a-zA-Z0-9-/_]+" }]
    },
    category: "Enterprise"
  },
  {
    name: "Redact GitHub PATs",
    description: "Redacts GitHub Personal Access Tokens.",
    definition: {
      action: "redact",
      conditions: [{ field: "prompt", operator: "matches", value: "ghp_[a-zA-Z0-9]{36}" }]
    },
    category: "Enterprise"
  }
];
