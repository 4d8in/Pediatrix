export interface LabResultInput {
  label: string;
  value: string;
}

export interface CreateReportInput {
  results: LabResultInput[];
  conclusion?: string;
}
