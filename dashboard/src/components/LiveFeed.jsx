import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm:ss") : "--:--:--";
};

const getEventColor = (type) => {
  const t = type?.toLowerCase() || "";
  if (t.includes("error") || t.includes("failed")) return "text-rose-500";
  if (t.includes("success") || t.includes("executed"))
    return "text-emerald-500";
  if (t.includes("warning") || t.includes("skipped")) return "text-yellow-500";
  return "text-blue-400";
};

export default function LiveFeed({ events = [] }) {
  return (
    <Card className="glass-card border-border/40 bg-black/40 h-full flex flex-col shadow-none">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground/90 font-sans tracking-tight">
            Activity Feed
          </CardTitle>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[500px]">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-foreground-muted">
              <Activity className="h-8 w-8 text-foreground-subtle mb-2 opacity-20" />
              <p className="text-xs">Waiting for events...</p>
            </div>
          ) : (
            <div className="flex flex-col font-mono text-xs">
              {events.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="group flex items-start gap-3 py-2 px-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0"
                >
                  <span className="text-foreground-subtle shrink-0 w-16 opacity-50">
                    {formatTime(event.timestamp)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={cn(
                          "uppercase font-medium tracking-tight",
                          getEventColor(event.type)
                        )}
                      >
                        {event.type?.split(".").pop()}
                      </span>
                    </div>
                    <p className="text-foreground-muted break-words leading-relaxed opacity-80">
                      {event.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
