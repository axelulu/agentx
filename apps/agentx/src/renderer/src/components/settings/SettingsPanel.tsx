import { useDispatch } from "react-redux";
import { setSettingsOpen } from "@/slices/uiSlice";
import { motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { ProviderConfig } from "./ProviderConfig";

export function SettingsPanel() {
  const dispatch = useDispatch();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => dispatch(setSettingsOpen(false))}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={() => dispatch(setSettingsOpen(false))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-6">
          <ProviderConfig />
        </div>
      </motion.div>
    </motion.div>
  );
}
