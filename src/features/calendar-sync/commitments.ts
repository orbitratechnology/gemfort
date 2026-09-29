import {
  addLocalDays,
  isLocalDateOnly,
  localAlertDate,
  localDayStart,
} from "./date-utils";

export type CommitmentSurface = "calendar" | "reminder";

export type SyncCommitment = {
  surface: CommitmentSurface;
  sourceType:
    | "trip"
    | "cheque"
    | "bill"
    | "ap"
    | "service"
    | "payable"
    | "receivable";
  sourceId: string;
  title: string;
  url: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  alertDate: Date;
};

export function makeSyncCommitment(input: {
  surface: CommitmentSurface;
  sourceType: SyncCommitment["sourceType"];
  sourceId: string;
  title: string;
  date: Date;
  endDate?: Date;
  url: string;
}): SyncCommitment {
  if (input.surface === "reminder") {
    const alertDate = localAlertDate(input.date);
    return {
      surface: "reminder",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      url: input.url,
      startDate: alertDate,
      endDate: alertDate,
      allDay: false,
      alertDate,
    };
  }

  const allDay =
    isLocalDateOnly(input.date) &&
    (!input.endDate || isLocalDateOnly(input.endDate));
  const startDate = allDay ? localDayStart(input.date) : new Date(input.date);
  const dateEnd = input.endDate ?? input.date;
  const endDate = allDay
    ? addLocalDays(localDayStart(dateEnd), 1)
    : new Date(dateEnd.getTime() + (input.endDate ? 0 : 60 * 60 * 1000));

  return {
    surface: "calendar",
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title: input.title,
    url: input.url,
    startDate,
    endDate,
    allDay,
    alertDate: allDay ? localAlertDate(startDate) : new Date(input.date),
  };
}
