import { BookingLifecycleStatus, TosBooking, TosLifecycleEvent } from "@/types/tos";

export interface BookingLifecycleChangedPayload {
  booking: TosBooking;
  previousStatus: BookingLifecycleStatus | null;
  nextStatus: BookingLifecycleStatus;
  lifecycleEvent: TosLifecycleEvent;
}

interface CoreEventMap {
  "booking.lifecycle.changed": BookingLifecycleChangedPayload;
  "booking.payment_confirmed": BookingLifecycleChangedPayload;
  "booking.supplier_confirmed": BookingLifecycleChangedPayload;
  "booking.completed": BookingLifecycleChangedPayload;
}

type EventHandler<K extends keyof CoreEventMap> = (
  payload: CoreEventMap[K]
) => Promise<void> | void;

export class InternalEventDispatcher {
  private readonly handlers = new Map<
    keyof CoreEventMap,
    Set<EventHandler<keyof CoreEventMap>>
  >();

  on<K extends keyof CoreEventMap>(eventName: K, handler: EventHandler<K>): () => void {
    const existing = this.handlers.get(eventName) ?? new Set<EventHandler<keyof CoreEventMap>>();
    const casted = handler as EventHandler<keyof CoreEventMap>;
    existing.add(casted);
    this.handlers.set(eventName, existing);

    return () => {
      const set = this.handlers.get(eventName);
      if (!set) return;
      set.delete(casted);
      if (set.size === 0) this.handlers.delete(eventName);
    };
  }

  async emit<K extends keyof CoreEventMap>(eventName: K, payload: CoreEventMap[K]): Promise<void> {
    const set = this.handlers.get(eventName);
    if (!set || set.size === 0) return;

    for (const handler of set) {
      await handler(payload as CoreEventMap[keyof CoreEventMap]);
    }
  }
}

export const bookingEventDispatcher = new InternalEventDispatcher();
