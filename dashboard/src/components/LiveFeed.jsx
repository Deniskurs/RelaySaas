import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Circle } from "lucide-react";

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm:ss") : "--:--:--";
};

const getEventColor = (type) => {
  const t = type?.toLowerCase() || "";
  if (t.includes("error") || t.includes("failed")) return "text-destructive";
  if (t.includes("success") || t.includes("executed")) return "text-success";
  if (t.includes("warning") || t.includes("skipped")) return "text-warning";
  return "text-foreground-muted";
};

export default function LiveFeed({ events = [] }) {
  return (
    <Card className="bg-card border border-border h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Activity</CardTitle>
        <div className="flex items-center gap-1.5">
          <Circle size={6} className="fill-success text-success" />
          <span className="text-xs text-foreground-muted">Live</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[500px] px-4">
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-foreground-muted text-sm">
              Waiting for events...
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {events.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="flex items-start gap-3 py-1.5 font-mono text-xs"
                >
                  <span className="text-foreground-subtle shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className={cn("shrink-0 uppercase font-medium", getEventColor(event.type))}>
                    {event.type}
                  </span>
                  <span className="text-foreground-muted break-all">{event.message}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
