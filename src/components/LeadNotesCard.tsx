import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useCreateLeadNote,
  useDeleteLeadNote,
  useLeadNotes,
  useUpdateLeadNote,
} from "@/hooks/useLeadNotes";
import { toast } from "@/hooks/use-toast";

type LeadNotesCardProps = {
  orgId: string;
  merchantId: string;
  leadId: string;
  conversationId?: string | null;
  currentUserId?: string | null;
};

export function LeadNotesCard({
  orgId,
  merchantId,
  leadId,
  conversationId,
  currentUserId,
}: LeadNotesCardProps) {
  const { data: notes = [], isLoading } = useLeadNotes(leadId);
  const createNote = useCreateLeadNote();
  const updateNote = useUpdateLeadNote();
  const deleteNote = useDeleteLeadNote();

  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const handleCreate = async () => {
    const body = newBody.trim();
    if (!body) return;

    try {
      await createNote.mutateAsync({
        orgId,
        merchantId,
        leadId,
        conversationId: conversationId ?? null,
        body,
      });
      setNewBody("");
      toast({ title: "Note added" });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Could not add note",
        description,
        variant: "destructive",
      });
    }
  };

  const startEditing = (noteId: string, body: string) => {
    setEditingId(noteId);
    setEditingBody(body);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingBody("");
  };

  const handleUpdate = async (noteId: string) => {
    const body = editingBody.trim();
    if (!body) return;
    try {
      await updateNote.mutateAsync({ id: noteId, leadId, body });
      cancelEditing();
      toast({ title: "Note updated" });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Could not update note",
        description,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync({ id: noteId, leadId });
      if (editingId === noteId) cancelEditing();
      toast({ title: "Note removed" });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Could not remove note",
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
            placeholder="Add context for teammates, objections, or next steps..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void handleCreate()}
              disabled={createNote.isPending || newBody.trim().length === 0}
            >
              {createNote.isPending ? "Adding..." : "Add note"}
            </Button>
          </div>
        </div>

        <Separator />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const isOwn = currentUserId === note.created_by_user_id;
              const isEditing = editingId === note.id;

              return (
                <div key={note.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {note.created_by_name ?? note.created_by_user_id.slice(0, 8)}
                      </span>{" - "}
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </div>
                    {isOwn && !isEditing && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditing(note.id, note.body)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => void handleDelete(note.id)}
                          disabled={deleteNote.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditing}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleUpdate(note.id)}
                          disabled={updateNote.isPending || editingBody.trim().length === 0}
                        >
                          {updateNote.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
