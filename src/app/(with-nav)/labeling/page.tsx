import { notFound } from "next/navigation";
import LabelingClient from "./labeling-client";

export default function LabelingPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LabelingClient />;
}
