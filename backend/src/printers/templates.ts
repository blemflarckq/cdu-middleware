export const generateTSPLBagLabel = (bag: {
  barcode: string;
  name: string;
  location: string;
}) => {
  return [
    `SIZE 101.6 mm, 152.4 mm`, // 4x6 inch label
    `GAP 3 mm, 0`,
    `DIRECTION 1`,
    `CLS`,
    // Name (X-coord, Y-coord, font, rotation, x-multi, y-multi, "text")
    `TEXT 50,50,"ROMAN.TTF",0,2,2,"${bag.name}"`,
    `TEXT 50,120,"ROMAN.TTF",0,1.5,1.5,"DEST: ${bag.location}"`,
    // Barcode (X, Y, type, height, human-readable, rotation, narrow, wide, "data")
    `BARCODE 50,220,"128",100,1,0,3,6,"${bag.barcode}"`,
    `PRINT 1`,
    `END`,
  ].join('\n');
};

export const generateEpsonSlip = (patient: any) => {
  // ESC/POS is binary, but we'll use a standard text format for the simulation
  return `
    --- DISPENSING SLIP ---
    PATIENT: ${patient.firstName} ${patient.lastName}
    FACILITY: ${patient.prescribingFacility}
    DATE: ${patient.collectionDate}
    -----------------------
    PLEASE COLLECT AT:
    ${patient.collectionLocation}
  `;
};