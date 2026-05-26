// config/printer.config.ts

export interface PrinterConfig {
  name: string;
  ip: string;
  type: 'thermal' | 'laser';
  paperSize?: string;
  width?: number;
  height?: number;
}

export const PRINTERS = {
  TSC_MAIN: {
    name: 'TSC MB240',
    ip: '192.168.26.43',
    type: 'thermal' as const,
    width: 4.05, // inches
    height: 6.01, // inches
  },
  HP_LASER: {
    name: 'HP LaserJet MFP M227fdw',
    ip: '192.168.26.41',
    type: 'laser' as const,
    paperSize: 'A4',
  },
};

// Label types
export type LabelType = 'bag' | 'box';
