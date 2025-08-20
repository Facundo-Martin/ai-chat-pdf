export type PDFMetadata = {
  source: string;
  pdf: {
    version: string;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      Title: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer: string;
      CreationDate?: string;
      ModDate?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Trapped?: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any;
    totalPages: number;
  };
  loc: {
    pageNumber: number;
  };
};

export type ProcessedPDFDocument = {
  pageContent: string;
  metadata: PDFMetadata;
  id?: string;
};
