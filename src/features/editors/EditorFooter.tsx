import { Trash2 } from "lucide-react";

export function EditorFooter({
  formId,
  isEdit,
  saveLabel,
  onDelete,
  onSaveAndNew,
  disabled,
}: {
  formId: string;
  isEdit: boolean;
  saveLabel?: string;
  onDelete?: () => void;
  onSaveAndNew?: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      {isEdit && onDelete ? (
        <button className="button button-danger-ghost" type="button" onClick={onDelete}>
          <Trash2 size={16} />
          删除
        </button>
      ) : onSaveAndNew ? (
        <button className="button button-ghost" disabled={disabled} type="button" onClick={onSaveAndNew}>
          保存并再记一笔
        </button>
      ) : (
        <span />
      )}
      <button className="button button-primary" disabled={disabled} form={formId} type="submit">
        {saveLabel ?? (isEdit ? "保存修改" : "保存")}
        <kbd className="kbd-inline">⌘↵</kbd>
      </button>
    </>
  );
}

/** Submits the form on ⌘/Ctrl + Enter. */
export function submitOnModEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}
