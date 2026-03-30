"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { TaskDefinition } from "@/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    category: "WORK" | "PERSONAL";
    isCustom: boolean;
    taskDefinitionId?: string;
  }) => Promise<void>;
  taskDefinitions: TaskDefinition[];
  type: "custom-work" | "personal";
  loading?: boolean;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  taskDefinitions,
  type,
  loading = false,
}: CreateTaskModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taskDefId, setTaskDefId] = useState("");

  const isPersonal = type === "personal";
  const category = isPersonal ? "PERSONAL" : "WORK";

  const filteredDefs = taskDefinitions.filter(
    (t) => t.category === (isPersonal ? "PERSONAL" : "WORK")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      isCustom: true,
      taskDefinitionId: taskDefId || undefined,
    });
    setName("");
    setDescription("");
    setTaskDefId("");
  };

  const handleSelectDef = (def: TaskDefinition) => {
    setName(def.name);
    setDescription(def.description || "");
    setTaskDefId(def.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPersonal ? "Add Personal Task" : "Add Custom Work Task"}
    >
      {filteredDefs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
            Quick select
          </p>
          <div className="flex flex-wrap gap-2">
            {filteredDefs.map((def) => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleSelectDef(def)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  taskDefId === def.id
                    ? isPersonal
                      ? "bg-orange-100 border-orange-300 text-orange-700"
                      : "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {def.name}
              </button>
            ))}
          </div>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-400">or enter manually</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Task name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isPersonal ? "e.g., Lunch break, Phone call..." : "e.g., Fixed broken display..."
            }
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details about this task..."
            className="input-field min-h-20 resize-none"
            rows={3}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={isPersonal ? "px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50" : "btn-primary"}
          >
            {loading ? "Starting..." : "Start Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
