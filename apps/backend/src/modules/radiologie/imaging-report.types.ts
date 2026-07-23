export interface ImagingResultInput {
  label: string;
  value: string;
}

export interface CreateImagingReportInput {
  results: ImagingResultInput[];
  conclusion?: string;
}
