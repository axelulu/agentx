import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { AppLayout } from "@/components/layout/AppLayout";

export function App() {
  const language = useSelector((state: RootState) => state.settings.language);
  return <AppLayout key={language} />;
}
