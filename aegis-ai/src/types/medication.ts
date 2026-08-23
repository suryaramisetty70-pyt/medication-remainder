export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;               // "HH:mm" local
  instructions?: string | null;
  created_at?: string;
}

export interface MedicationInput {
  name: string;
  dosage: string;
  time: string;
  instructions?: string;
}
