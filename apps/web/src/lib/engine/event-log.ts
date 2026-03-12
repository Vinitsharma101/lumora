/**
 * Event-sourced edit history.
 *
 * Every mutation to the timeline is recorded as an EditEvent.
 * The full timeline state can be reconstructed by replaying events.
 * This enables branching, AI-reversible edits, and collaboration.
 */

export type EditEventType =
	| "INSERT_ELEMENT"
	| "DELETE_ELEMENTS"
	| "MOVE_ELEMENT"
	| "TRIM_ELEMENT"
	| "SPLIT_ELEMENT"
	| "UPDATE_ELEMENT"
	| "ADD_TRACK"
	| "REMOVE_TRACK"
	| "DUPLICATE_ELEMENTS"
	| "PASTE_ELEMENTS"
	| "BATCH";

export interface EditEvent {
	/** Unique event id. */
	id: string;
	/** Event type discriminator. */
	type: EditEventType;
	/** Serialisable payload specific to the event type. */
	payload: Record<string, unknown>;
	/** ISO timestamp of when the event occurred. */
	timestamp: string;
	/** Optional: id of the agent or user that produced this event. */
	source?: string;
	/** Optional: parent event id for branching. */
	parentId?: string;
}

/**
 * EventLog stores an ordered sequence of edit events.
 * Supports streaming (append-only) and branching (fork from a point).
 */
export class EventLog {
	private events: EditEvent[] = [];
	private branchPoint: number | null = null;

	/** Append a new event. */
	append(event: Omit<EditEvent, "id" | "timestamp">): EditEvent {
		const full: EditEvent = {
			...event,
			id: generateEventId(),
			timestamp: new Date().toISOString(),
			parentId:
				this.events.length > 0
					? this.events[this.events.length - 1].id
					: undefined,
		};
		this.events.push(full);
		return full;
	}

	/** Get all events in order. */
	getEvents(): readonly EditEvent[] {
		return this.events;
	}

	/** Get events since a specific event id (exclusive). */
	getEventsSince(eventId: string): EditEvent[] {
		const idx = this.events.findIndex((e) => e.id === eventId);
		if (idx === -1) return [...this.events];
		return this.events.slice(idx + 1);
	}

	/** Get the latest N events. */
	getRecentEvents(count: number): EditEvent[] {
		return this.events.slice(-count);
	}

	/** Create a branch from a specific event id. Events after that id are removed. */
	branchFrom(eventId: string): EditEvent[] {
		const idx = this.events.findIndex((e) => e.id === eventId);
		if (idx === -1) {
			throw new Error(`Event ${eventId} not found`);
		}
		const removed = this.events.splice(idx + 1);
		this.branchPoint = idx;
		return removed;
	}

	/** Serialise the event log to JSON-compatible format. */
	toJSON(): EditEvent[] {
		return [...this.events];
	}

	/** Restore from serialised events. */
	static fromJSON(events: EditEvent[]): EventLog {
		const log = new EventLog();
		log.events = [...events];
		return log;
	}

	/** Number of events. */
	get length(): number {
		return this.events.length;
	}

	/** Clear all events. */
	clear(): void {
		this.events = [];
		this.branchPoint = null;
	}
}

let eventCounter = 0;
function generateEventId(): string {
	eventCounter++;
	return `evt_${Date.now()}_${eventCounter}`;
}
