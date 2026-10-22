import { useState } from "react";
import type { ContributionEvent } from "@/lib/calc/types";

type PaycheckTableProps = {
  events: ContributionEvent[];
  className: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 10;

export function PaycheckTable({ events, className }: PaycheckTableProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleEvents = events.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  return (
    <section className={className} aria-labelledby="schedule-title">
      <div className="schedule-heading">
        <div>
          <p className="eyebrow">UPCOMING CONTRIBUTIONS</p>
          <h2 id="schedule-title">Paycheck-by-paycheck</h2>
        </div>
        <span className="schedule-count">{events.length} events</span>
      </div>
      {events.length === 0 ? (
        <p className="empty-schedule">
          Your upcoming pay events will appear here once your details are valid.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Gross</th>
                <th scope="col">Contribution</th>
                <th scope="col">Year to date</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((event) => (
                <tr
                  className={
                    event.type === "bonus" ? "bonus-row" : undefined
                  }
                  key={event.id}
                >
                  <td>
                    {new Date(`${event.date}T12:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" },
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        event.type === "bonus"
                          ? "event-type event-type--bonus"
                          : "event-type"
                      }
                    >
                      {event.type === "bonus" ? "Bonus" : "Paycheck"}
                    </span>
                  </td>
                  <td className="tabular-number">{money.format(event.gross)}</td>
                  <td className="tabular-number">
                    {money.format(event.contribution)}
                    <span className="table-rate"> ({event.rate}%)</span>
                  </td>
                  <td className="tabular-number">
                    {money.format(event.yearToDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {events.length > PAGE_SIZE && (
        <nav className="table-pagination" aria-label="Paycheck table pages">
          <button
            className="button button--secondary button--compact"
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {currentPage + 1} of {pageCount} · Showing{" "}
            {currentPage * PAGE_SIZE + 1}–
            {Math.min((currentPage + 1) * PAGE_SIZE, events.length)} of{" "}
            {events.length}
          </span>
          <button
            className="button button--secondary button--compact"
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() =>
              setPage((value) => Math.min(pageCount - 1, value + 1))
            }
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
