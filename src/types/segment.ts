export type FilterOperator = "AND" | "OR";

export type SegmentFilter =
  | { type: "platform"; value: "twitter" | "connpass" | "line" | "did-event" }
  | { type: "keyword"; value: string }
  | { type: "location"; value: string }
  | { type: "behavior"; value: "event-attended" | "post-about" | "follows" }
  | { type: "vc"; credentialType: string }
  | { type: "token"; minAmount: number };

export type Segment = {
  operator: FilterOperator;
  filters: SegmentFilter[];
};
