import { execFile } from "node:child_process";
import type { NamedToolHandler } from "../types";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Run an AppleScript snippet and return stdout.
 */
function runAppleScript(script: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "osascript",
      ["-e", script],
      { timeout: timeoutMs, maxBuffer: 1024 * 512 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message));
        } else {
          resolve(stdout.trim());
        }
      },
    );
    // Ensure child doesn't linger
    child.unref?.();
  });
}

/**
 * Escape a string for safe interpolation inside AppleScript double-quoted strings.
 */
function escapeAS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ── Calendar Tools ──────────────────────────────────────────

function calendarList(): NamedToolHandler {
  return {
    name: "calendar_list_events",
    description:
      "List upcoming calendar events from macOS Calendar. " +
      "Returns event title, start/end time, location, and calendar name.",
    parameters: {
      type: "object",
      properties: {
        days_ahead: {
          type: "number",
          description:
            "Number of days ahead to look for events (default: 7). Use 0 for today only.",
        },
        calendar_name: {
          type: "string",
          description: "Optional: filter to a specific calendar name.",
        },
      },
      required: [],
    },
    options: { category: "parallel" },
    async handler(args) {
      const days = (args.days_ahead as number) ?? 7;
      const calFilter = args.calendar_name as string | undefined;

      // Iterate each calendar individually to avoid nested-list issues.
      const calListExpr = calFilter ? `{calendar "${escapeAS(calFilter)}"}` : `every calendar`;

      const script = `
set startDate to current date
set endDate to startDate + ${days + 1} * days
set output to ""
tell application "Calendar"
  repeat with cal in ${calListExpr}
    set calName to name of cal
    try
      set evts to (every event of cal whose start date ≥ startDate and start date < endDate)
      repeat with evt in evts
        set evtTitle to summary of evt
        set evtStart to start date of evt
        set evtEnd to end date of evt
        set evtLoc to location of evt
        if evtLoc is missing value then set evtLoc to ""
        set output to output & calName & "\\t" & evtTitle & "\\t" & (evtStart as string) & "\\t" & (evtEnd as string) & "\\t" & evtLoc & "\\n"
      end repeat
    end try
  end repeat
end tell
return output`;

      try {
        const raw = await runAppleScript(script);
        if (!raw) {
          return { content: JSON.stringify({ events: [], message: "No events found." }) };
        }
        const events = raw
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [calendar, title, start, end, location] = line.split("\t");
            return { calendar, title, start, end, location: location || undefined };
          });
        return { content: JSON.stringify({ events, count: events.length }) };
      } catch (err) {
        return {
          content: `Error listing calendar events: ${(err as Error).message}`,
          isError: true,
        };
      }
    },
  };
}

function calendarCreate(): NamedToolHandler {
  return {
    name: "calendar_create_event",
    description:
      "Create a new event in macOS Calendar. " +
      "Specify title, start/end time, and optionally location and calendar name.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title." },
        start_date: {
          type: "string",
          description:
            'Start date and time in natural format, e.g. "2025-03-28 15:00" or "March 28, 2025 3:00 PM".',
        },
        end_date: {
          type: "string",
          description: "End date and time. If omitted, defaults to 1 hour after start.",
        },
        location: { type: "string", description: "Event location (optional)." },
        notes: { type: "string", description: "Event notes/description (optional)." },
        calendar_name: {
          type: "string",
          description: "Calendar name to add the event to (default: system default calendar).",
        },
        all_day: {
          type: "boolean",
          description: "Whether this is an all-day event (default: false).",
        },
      },
      required: ["title", "start_date"],
    },
    options: { category: "sequential" },
    async handler(args) {
      const title = escapeAS(args.title as string);
      const startDate = escapeAS(args.start_date as string);
      const endDate = args.end_date ? escapeAS(args.end_date as string) : null;
      const location = args.location ? escapeAS(args.location as string) : null;
      const notes = args.notes ? escapeAS(args.notes as string) : null;
      const calName = args.calendar_name ? escapeAS(args.calendar_name as string) : null;
      const allDay = (args.all_day as boolean) ?? false;

      const endClause = endDate
        ? `set end date of newEvent to date "${endDate}"`
        : `set end date of newEvent to (start date of newEvent) + 60 * 60`;
      const locClause = location ? `set location of newEvent to "${location}"` : "";
      const notesClause = notes ? `set description of newEvent to "${notes}"` : "";
      const allDayClause = allDay ? `set allday event of newEvent to true` : "";
      const calClause = calName ? `calendar "${calName}"` : `default calendar`;

      const script = `
tell application "Calendar"
  tell ${calClause}
    set newEvent to make new event with properties {summary:"${title}", start date:date "${startDate}"}
    ${endClause}
    ${locClause}
    ${notesClause}
    ${allDayClause}
  end tell
end tell
return "ok"`;

      try {
        await runAppleScript(script);
        return {
          content: JSON.stringify({
            created: true,
            title: args.title,
            start: args.start_date,
            end: args.end_date ?? "(1 hour after start)",
            calendar: args.calendar_name ?? "(default)",
          }),
        };
      } catch (err) {
        return {
          content: `Error creating calendar event: ${(err as Error).message}`,
          isError: true,
        };
      }
    },
  };
}

// ── Reminder Tools ──────────────────────────────────────────

function remindersList(): NamedToolHandler {
  return {
    name: "reminders_list",
    description:
      "List reminders from macOS Reminders app. " +
      "Returns incomplete reminders with name, due date, priority, and list name.",
    parameters: {
      type: "object",
      properties: {
        list_name: {
          type: "string",
          description: "Optional: filter to a specific reminders list.",
        },
        include_completed: {
          type: "boolean",
          description: "Include completed reminders (default: false).",
        },
      },
      required: [],
    },
    options: { category: "parallel" },
    async handler(args) {
      const listFilter = args.list_name as string | undefined;
      const includeCompleted = (args.include_completed as boolean) ?? false;

      const completedFilter = includeCompleted ? "" : "whose completed is false";

      // When filtering by list name, query that list directly.
      // Otherwise iterate each list to avoid nested-list issues.
      const script = listFilter
        ? `
set output to ""
tell application "Reminders"
  set rems to every reminder of list "${escapeAS(listFilter)}" ${completedFilter}
  repeat with r in rems
    set rName to name of r
    set rDue to due date of r
    set rPri to priority of r
    set rCompleted to completed of r
    if rDue is missing value then
      set rDueStr to ""
    else
      set rDueStr to rDue as string
    end if
    set output to output & "${escapeAS(listFilter)}" & "\\t" & rName & "\\t" & rDueStr & "\\t" & rPri & "\\t" & rCompleted & "\\n"
  end repeat
end tell
return output`
        : `
set output to ""
tell application "Reminders"
  repeat with l in every list
    set lName to name of l
    set rems to every reminder of l ${completedFilter}
    repeat with r in rems
      set rName to name of r
      set rDue to due date of r
      set rPri to priority of r
      set rCompleted to completed of r
      if rDue is missing value then
        set rDueStr to ""
      else
        set rDueStr to rDue as string
      end if
      set output to output & lName & "\\t" & rName & "\\t" & rDueStr & "\\t" & rPri & "\\t" & rCompleted & "\\n"
    end repeat
  end repeat
end tell
return output`;

      try {
        const raw = await runAppleScript(script);
        if (!raw) {
          return { content: JSON.stringify({ reminders: [], message: "No reminders found." }) };
        }
        const reminders = raw
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [list, name, dueDate, priority, completed] = line.split("\t");
            return {
              list,
              name,
              dueDate: dueDate || undefined,
              priority: priority ? Number(priority) : 0,
              completed: completed === "true",
            };
          });
        return { content: JSON.stringify({ reminders, count: reminders.length }) };
      } catch (err) {
        return { content: `Error listing reminders: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

function remindersCreate(): NamedToolHandler {
  return {
    name: "reminders_create",
    description:
      "Create a new reminder in macOS Reminders. " +
      "Specify name, optional due date, priority, and list.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Reminder name/title." },
        due_date: {
          type: "string",
          description:
            'Due date and time, e.g. "2025-03-28 15:00" or "tomorrow 3:00 PM". Optional.',
        },
        list_name: {
          type: "string",
          description: "Reminders list to add to (default: default list).",
        },
        priority: {
          type: "number",
          description: "Priority: 0 = none, 1 = high, 5 = medium, 9 = low.",
        },
        notes: { type: "string", description: "Additional notes for the reminder." },
      },
      required: ["name"],
    },
    options: { category: "sequential" },
    async handler(args) {
      const name = escapeAS(args.name as string);
      const dueDate = args.due_date ? escapeAS(args.due_date as string) : null;
      const listName = args.list_name ? escapeAS(args.list_name as string) : null;
      const priority = (args.priority as number) ?? 0;
      const notes = args.notes ? escapeAS(args.notes as string) : null;

      const dueClause = dueDate ? `, remind me date:date "${dueDate}"` : "";
      const priorityClause = priority ? `, priority:${priority}` : "";
      const notesClause = notes ? `\nset body of newReminder to "${notes}"` : "";
      const listClause = listName ? `list "${listName}"` : "default list";

      const script = `
tell application "Reminders"
  tell ${listClause}
    set newReminder to make new reminder with properties {name:"${name}"${dueClause}${priorityClause}}${notesClause}
  end tell
end tell
return "ok"`;

      try {
        await runAppleScript(script);
        return {
          content: JSON.stringify({
            created: true,
            name: args.name,
            dueDate: args.due_date ?? "(none)",
            list: args.list_name ?? "(default)",
          }),
        };
      } catch (err) {
        return { content: `Error creating reminder: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

// ── Notes Tools ─────────────────────────────────────────────

function notesList(): NamedToolHandler {
  return {
    name: "notes_list",
    description:
      "List notes from macOS Notes app. Returns note name, folder, and creation/modification dates.",
    parameters: {
      type: "object",
      properties: {
        folder_name: {
          type: "string",
          description: "Optional: filter to a specific folder.",
        },
        search_text: {
          type: "string",
          description: "Optional: search for notes containing this text.",
        },
        limit: {
          type: "number",
          description: "Maximum number of notes to return (default: 20).",
        },
      },
      required: [],
    },
    options: { category: "parallel" },
    async handler(args) {
      const folder = args.folder_name as string | undefined;
      const search = args.search_text as string | undefined;
      const limit = (args.limit as number) ?? 20;

      const folderClause = folder ? `of folder "${escapeAS(folder)}"` : "";
      const searchFilter = search
        ? `whose name contains "${escapeAS(search)}" or body contains "${escapeAS(search)}"`
        : "";

      const script = `
set output to ""
set counter to 0
tell application "Notes"
  set notesList to every note ${folderClause} ${searchFilter}
  repeat with n in notesList
    if counter ≥ ${limit} then exit repeat
    try
      set nName to name of n
      set nFolder to ""
      try
        set nFolder to name of container of n
      end try
      set nCreated to creation date of n
      set nModified to modification date of n
      set output to output & nFolder & "\\t" & nName & "\\t" & (nCreated as string) & "\\t" & (nModified as string) & "\\n"
      set counter to counter + 1
    end try
  end repeat
end tell
return output`;

      try {
        const raw = await runAppleScript(script);
        if (!raw) {
          return { content: JSON.stringify({ notes: [], message: "No notes found." }) };
        }
        const notes = raw
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [folder_, name, created, modified] = line.split("\t");
            return { folder: folder_, name, created, modified };
          });
        return { content: JSON.stringify({ notes, count: notes.length }) };
      } catch (err) {
        return { content: `Error listing notes: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

function notesRead(): NamedToolHandler {
  return {
    name: "notes_read",
    description:
      "Read the full content of a specific note from macOS Notes. " +
      "Provide the note name (and optionally the folder).",
    parameters: {
      type: "object",
      properties: {
        note_name: { type: "string", description: "Exact name of the note to read." },
        folder_name: { type: "string", description: "Folder containing the note (optional)." },
      },
      required: ["note_name"],
    },
    options: { category: "parallel" },
    async handler(args) {
      const noteName = escapeAS(args.note_name as string);
      const folder = args.folder_name ? escapeAS(args.folder_name as string) : null;

      const folderClause = folder ? `of folder "${folder}"` : "";

      const script = `
tell application "Notes"
  set matchingNotes to every note ${folderClause} whose name is "${noteName}"
  if (count of matchingNotes) is 0 then
    return "NOT_FOUND"
  end if
  set n to item 1 of matchingNotes
  set nBody to plaintext of n
  set nFolder to ""
  try
    set nFolder to name of container of n
  end try
  set nCreated to creation date of n
  set nModified to modification date of n
  return nFolder & "\\t" & name of n & "\\t" & (nCreated as string) & "\\t" & (nModified as string) & "\\t" & nBody
end tell`;

      try {
        const raw = await runAppleScript(script);
        if (raw === "NOT_FOUND") {
          return {
            content: JSON.stringify({ found: false, note_name: args.note_name }),
            isError: true,
          };
        }
        const idx = raw.indexOf("\t");
        const parts = raw.split("\t");
        return {
          content: JSON.stringify({
            found: true,
            folder: parts[0],
            name: parts[1],
            created: parts[2],
            modified: parts[3],
            content: parts.slice(4).join("\t"),
          }),
        };
      } catch (err) {
        return { content: `Error reading note: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

function notesCreate(): NamedToolHandler {
  return {
    name: "notes_create",
    description: "Create a new note in macOS Notes app. Provide a name and body content.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Note title." },
        body: { type: "string", description: "Note body content (plain text or HTML)." },
        folder_name: {
          type: "string",
          description: "Folder to create the note in (default: default folder).",
        },
      },
      required: ["name", "body"],
    },
    options: { category: "sequential" },
    async handler(args) {
      const name = escapeAS(args.name as string);
      const body = escapeAS(args.body as string);
      const folder = args.folder_name ? escapeAS(args.folder_name as string) : null;

      const folderClause = folder ? `folder "${folder}"` : "default account";
      // Notes.app uses HTML for body content via make new note
      const script = `
tell application "Notes"
  tell ${folderClause}
    make new note with properties {name:"${name}", body:"${body}"}
  end tell
end tell
return "ok"`;

      try {
        await runAppleScript(script);
        return {
          content: JSON.stringify({
            created: true,
            name: args.name,
            folder: args.folder_name ?? "(default)",
          }),
        };
      } catch (err) {
        return { content: `Error creating note: ${(err as Error).message}`, isError: true };
      }
    },
  };
}

// ── Export ───────────────────────────────────────────────────

/**
 * Create all Apple PIM (Calendar, Reminders, Notes) tool handlers.
 * Uses AppleScript via osascript — requires apple-events entitlement.
 */
export function createApplePimToolHandlers(): NamedToolHandler[] {
  // Only available on macOS
  if (process.platform !== "darwin") return [];

  return [
    calendarList(),
    calendarCreate(),
    remindersList(),
    remindersCreate(),
    notesList(),
    notesRead(),
    notesCreate(),
  ];
}
