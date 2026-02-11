/**
 * Logo / brand data for common tech companies.
 * Includes domain for logo fetching via Clearbit / Google Favicon APIs.
 */

export interface LogoEntry {
  name: string;
  abbreviation: string;
  color: string;
  domain: string;
  icon?: string;
}

export const LOGOS: Record<string, LogoEntry> = {
  salesforce: {
    name: 'Salesforce',
    abbreviation: 'SF',
    color: '#00A1E0',
    domain: 'salesforce.com',
    icon: '☁️',
  },
  slack: {
    name: 'Slack',
    abbreviation: 'SL',
    color: '#4A154B',
    domain: 'slack.com',
    icon: '💬',
  },
  atlassian: {
    name: 'Atlassian',
    abbreviation: 'AT',
    color: '#0052CC',
    domain: 'atlassian.com',
    icon: '🔷',
  },
  hubspot: {
    name: 'HubSpot',
    abbreviation: 'HS',
    color: '#FF7A59',
    domain: 'hubspot.com',
    icon: '🟠',
  },
  zendesk: {
    name: 'Zendesk',
    abbreviation: 'ZD',
    color: '#03363D',
    domain: 'zendesk.com',
    icon: '💚',
  },
  servicenow: {
    name: 'ServiceNow',
    abbreviation: 'SN',
    color: '#81B5A1',
    domain: 'servicenow.com',
    icon: '⚙️',
  },
  workday: {
    name: 'Workday',
    abbreviation: 'WD',
    color: '#F68D2E',
    domain: 'workday.com',
    icon: '🌅',
  },
  openai: {
    name: 'OpenAI',
    abbreviation: 'AI',
    color: '#10A37F',
    domain: 'openai.com',
    icon: '🤖',
  },
  google: {
    name: 'Google',
    abbreviation: 'G',
    color: '#4285F4',
    domain: 'google.com',
    icon: '🔍',
  },
  microsoft: {
    name: 'Microsoft',
    abbreviation: 'MS',
    color: '#00A4EF',
    domain: 'microsoft.com',
    icon: '🪟',
  },
  nvidia: {
    name: 'NVIDIA',
    abbreviation: 'NV',
    color: '#76B900',
    domain: 'nvidia.com',
    icon: '🟢',
  },
  meta: {
    name: 'Meta',
    abbreviation: 'M',
    color: '#0668E1',
    domain: 'meta.com',
    icon: 'Ⓜ️',
  },
  amazon: {
    name: 'Amazon',
    abbreviation: 'AZ',
    color: '#FF9900',
    domain: 'amazon.com',
    icon: '📦',
  },
  apple: {
    name: 'Apple',
    abbreviation: 'A',
    color: '#A2AAAD',
    domain: 'apple.com',
    icon: '🍎',
  },
  klarna: {
    name: 'Klarna',
    abbreviation: 'K',
    color: '#FFB3C7',
    domain: 'klarna.com',
    icon: '💗',
  },
  stripe: {
    name: 'Stripe',
    abbreviation: 'S',
    color: '#635BFF',
    domain: 'stripe.com',
    icon: '💳',
  },
  shopify: {
    name: 'Shopify',
    abbreviation: 'SH',
    color: '#96BF48',
    domain: 'shopify.com',
    icon: '🛒',
  },
  notion: {
    name: 'Notion',
    abbreviation: 'N',
    color: '#000000',
    domain: 'notion.so',
    icon: '📝',
  },
  figma: {
    name: 'Figma',
    abbreviation: 'FG',
    color: '#F24E1E',
    domain: 'figma.com',
    icon: '🎨',
  },
  github: {
    name: 'GitHub',
    abbreviation: 'GH',
    color: '#FFFFFF',
    domain: 'github.com',
    icon: '🐙',
  },
  anthropic: {
    name: 'Anthropic',
    abbreviation: 'A',
    color: '#D4A574',
    domain: 'anthropic.com',
  },
  claude: {
    name: 'Claude',
    abbreviation: 'C',
    color: '#D4A574',
    domain: 'claude.ai',
  },
  'claude 3.5 sonnet': {
    name: 'Claude 3.5 Sonnet',
    abbreviation: 'C',
    color: '#D4A574',
    domain: 'claude.ai',
  },
  gcc: {
    name: 'GCC',
    abbreviation: 'GCC',
    color: '#FFCB2B',
    domain: 'gcc.gnu.org',
  },
  linux: {
    name: 'Linux',
    abbreviation: 'LX',
    color: '#FCC624',
    domain: 'kernel.org',
  },
};

/**
 * Case-insensitive lookup for a logo entry by company name.
 */
export function getLogoEntry(name: string): LogoEntry | undefined {
  const key = name.toLowerCase().trim();
  return LOGOS[key];
}

/**
 * Case-insensitive lookup that returns just the domain for a company.
 * Returns null if the company is not in the registry.
 */
export function getLogoDomain(companyName: string): string | null {
  const entry = getLogoEntry(companyName);
  return entry?.domain ?? null;
}
