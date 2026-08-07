// Status types
export type ReportStatus = 
  | 'PENDING'
  | 'REPORTED'
  | 'RESOLVED'
  | 'FALSE_REPORT'
  | 'DUPLICATE_REPORT'
  | 'MINOR_LITTER'
  | 'ALREADY_RESOLVED'
  | 'PRIVATE_PROPERTY';

// Status configuration
export const STATUS_CONFIG = {
  REPORTED: {
    label: 'Reported',
    color: 'bg-blue-100 text-blue-700',
    icon: '',
    description: 'Report has been submitted and is pending review'
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-700',
    icon: '',
    description: 'Issue has been addressed and cleaned up'
  },
  FALSE_REPORT: {
    label: 'False Report',
    color: 'bg-red-100 text-red-700',
    icon: '',
    description: 'Report is not valid or verified'
  },
  DUPLICATE_REPORT: {
    label: 'Duplicate Report',
    color: 'bg-orange-100 text-orange-700',
    icon: '',
    description: 'This issue has already been reported'
  },
  MINOR_LITTER: {
    label: 'Minor Litter',
    color: 'bg-yellow-100 text-yellow-700',
    icon: '',
    description: 'Small amount of litter, not a major issue'
  },
  ALREADY_RESOLVED: {
    label: 'Already Resolved',
    color: 'bg-teal-100 text-teal-700',
    icon: '',
    description: 'This issue was already resolved before reporting'
  },
  PRIVATE_PROPERTY: {
    label: 'Private Property',
    color: 'bg-purple-100 text-purple-700',
    icon: '',
    description: 'Issue is on private property'
  },
} as const;

// Status filter order
const STATUS_FILTERS = [
  'ALL',
  'REPORTED',
  'RESOLVED',
  'FALSE_REPORT',
  'DUPLICATE_REPORT',
  'MINOR_LITTER',
  'ALREADY_RESOLVED',
  'PRIVATE_PROPERTY'
] as const;

type StatusFilter = typeof STATUS_FILTERS[number];