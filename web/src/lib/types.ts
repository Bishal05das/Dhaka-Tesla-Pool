// Response shapes of the Express API (see api/src/modules/*/*.presenter.ts and services).
// All money is integer poisha (৳1 = 100 poisha).

export type Role = 'PASSENGER' | 'DRIVER';
export type RideStatus = 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = Exclude<RideStatus, 'REQUESTED'>;
export type PaymentMethod = 'CASH' | 'WALLET';

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  capacity: number;
  isOnline: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  vehicle: Vehicle | null;
}

export interface Stop {
  id: number;
  name: string;
  sequence: number;
  distanceFromStartM: number;
  lat: number;
  lng: number;
}

export interface FareBreakdown {
  basePoisha: number;
  distanceChargePoisha: number;
  poolDiscountPoisha: number;
  totalPoisha: number;
  pooled: boolean;
}

export interface FareQuote {
  trip: {
    pickup: { id: number; name: string };
    drop: { id: number; name: string };
    distanceM: number;
    seats: number;
  };
  estimate: { solo: FareBreakdown; pooled: FareBreakdown };
}

export interface Ride {
  id: string;
  status: RideStatus;
  pickup: { id: number; name: string };
  drop: { id: number; name: string };
  seats: number;
  paymentMethod: PaymentMethod;
  distanceM: number;
  estimate: { soloPoisha: number; pooledPoisha: number };
  fare: FareBreakdown | null;
  payment: { method: PaymentMethod; amountPoisha: number; paidAt: string } | null;
  tesla: {
    driverName: string;
    vehicleName: string;
    plate: string;
    tripStatus: PoolStatus;
    coRiders: number;
  } | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideDetail extends Ride {
  timeline: { status: RideStatus; at: string; by: 'you' | 'driver' | 'system'; reason: string | null }[];
}

export interface Wallet {
  balancePoisha: number;
  transactions: {
    id: string;
    type: 'TOPUP' | 'RIDE_PAYMENT';
    amountPoisha: number;
    balanceAfterPoisha: number;
    rideRequestId: string | null;
    createdAt: string;
  }[];
}

export interface OpenRequest {
  id: string;
  passengerName: string;
  pickup: { id: number; name: string };
  drop: { id: number; name: string };
  seats: number;
  distanceM: number;
  paymentMethod: PaymentMethod;
  estimate: { soloPoisha: number; pooledPoisha: number };
  requestedAt: string;
}

export interface PoolPassenger {
  rideId: string;
  name: string;
  seats: number;
  drop: { id: number; name: string };
  status: RideStatus;
  paymentMethod: PaymentMethod;
  farePoisha: number | null;
  paidBy: PaymentMethod | null;
  joinedAt: string;
}

export interface Pool {
  id: string;
  status: PoolStatus;
  capacity: number;
  seatsOccupied: number;
  seatsFree: number;
  createdAt: string;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  passengers: PoolPassenger[];
}

export interface DriverTrip extends Pool {
  earnedPoisha: number;
}
