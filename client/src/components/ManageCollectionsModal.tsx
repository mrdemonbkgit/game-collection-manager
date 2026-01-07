import { useState } from 'react';
import { Collection, CreateCollectionInput } from '../types/collection';

interface ManageCollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  onEdit: (collection: Collection, input: CreateCollectionInput) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
}

export default function ManageCollectionsModal({
  isOpen,
  onClose,
  collections,
  onEdit,
  onDelete,
  onCreate,
}: ManageCollectionsModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  if (!isOpen) return null;

  const startEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setEditName(collection.name);
    setEditDescription(collection.description || '');
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEdit = (collection: Collection) => {
    if (!editName.trim()) return;
    onEdit(collection, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });
    cancelEdit();
  };

  const confirmDelete = (id: number) => {
    setDeleteConfirmId(id);
    setEditingId(null);
  };

  const executeDelete = (id: number) => {
    onDelete(id);
    setDeleteConfirmId(null);
  };

  // Separate regular collections from smart filters
  const regularCollections = collections.filter((c) => !c.isSmartFilter);
  const smartFilters = collections.filter((c) => c.isSmartFilter);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="manage-collections-overlay"
    >
      <div
        className="bg-steam-bg-card rounded-lg shadow-xl w-full max-w-lg mx-4 border border-steam-border max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="manage-collections-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-steam-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-steam-text">
            Manage Collections
          </h2>
          <button
            onClick={onCreate}
            className="px-3 py-1.5 text-sm bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
            data-testid="create-new-collection"
          >
            + New Collection
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {collections.length === 0 ? (
            <p className="text-steam-text-muted text-center py-8">
              No collections yet. Create one to get started!
            </p>
          ) : (
            <div className="space-y-6">
              {/* Regular Collections */}
              {regularCollections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-steam-text-muted uppercase tracking-wider mb-3">
                    Collections ({regularCollections.length})
                  </h3>
                  <div className="space-y-2">
                    {regularCollections.map((collection) => (
                      <CollectionRow
                        key={collection.id}
                        collection={collection}
                        isEditing={editingId === collection.id}
                        isDeleting={deleteConfirmId === collection.id}
                        editName={editName}
                        editDescription={editDescription}
                        onEditNameChange={setEditName}
                        onEditDescriptionChange={setEditDescription}
                        onStartEdit={() => startEdit(collection)}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={() => saveEdit(collection)}
                        onConfirmDelete={() => confirmDelete(collection.id)}
                        onCancelDelete={() => setDeleteConfirmId(null)}
                        onExecuteDelete={() => executeDelete(collection.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Filters */}
              {smartFilters.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-steam-text-muted uppercase tracking-wider mb-3">
                    Smart Filters ({smartFilters.length})
                  </h3>
                  <div className="space-y-2">
                    {smartFilters.map((collection) => (
                      <CollectionRow
                        key={collection.id}
                        collection={collection}
                        isEditing={editingId === collection.id}
                        isDeleting={deleteConfirmId === collection.id}
                        editName={editName}
                        editDescription={editDescription}
                        onEditNameChange={setEditName}
                        onEditDescriptionChange={setEditDescription}
                        onStartEdit={() => startEdit(collection)}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={() => saveEdit(collection)}
                        onConfirmDelete={() => confirmDelete(collection.id)}
                        onCancelDelete={() => setDeleteConfirmId(null)}
                        onExecuteDelete={() => executeDelete(collection.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-steam-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-steam-text-muted hover:text-steam-text transition-colors"
            data-testid="close-manage-collections"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface CollectionRowProps {
  collection: Collection;
  isEditing: boolean;
  isDeleting: boolean;
  editName: string;
  editDescription: string;
  onEditNameChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onExecuteDelete: () => void;
}

function CollectionRow({
  collection,
  isEditing,
  isDeleting,
  editName,
  editDescription,
  onEditNameChange,
  onEditDescriptionChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onConfirmDelete,
  onCancelDelete,
  onExecuteDelete,
}: CollectionRowProps) {
  if (isDeleting) {
    return (
      <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
        <p className="text-sm text-steam-text mb-3">
          Delete "{collection.name}"? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onExecuteDelete}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            data-testid={`confirm-delete-${collection.id}`}
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="px-3 py-1.5 text-sm text-steam-text-muted hover:text-steam-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="p-3 bg-steam-bg-dark border border-steam-border rounded-md space-y-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          className="w-full px-2 py-1.5 bg-steam-bg-card border border-steam-border rounded text-sm text-steam-text focus:outline-none focus:ring-1 focus:ring-steam-accent"
          placeholder="Collection name"
          autoFocus
          data-testid={`edit-name-${collection.id}`}
        />
        <input
          type="text"
          value={editDescription}
          onChange={(e) => onEditDescriptionChange(e.target.value)}
          className="w-full px-2 py-1.5 bg-steam-bg-card border border-steam-border rounded text-sm text-steam-text focus:outline-none focus:ring-1 focus:ring-steam-accent"
          placeholder="Description (optional)"
          data-testid={`edit-description-${collection.id}`}
        />
        <div className="flex gap-2">
          <button
            onClick={onSaveEdit}
            className="px-3 py-1.5 text-sm bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
            data-testid={`save-edit-${collection.id}`}
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 text-sm text-steam-text-muted hover:text-steam-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 bg-steam-bg-dark border border-steam-border rounded-md flex items-center justify-between group"
      data-testid={`collection-row-${collection.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {collection.isSmartFilter && (
            <span className="text-steam-accent" title="Smart Filter">
              ⚡
            </span>
          )}
          <span className="text-sm text-steam-text truncate">
            {collection.name}
          </span>
          <span className="text-xs text-steam-text-muted">
            {collection.isSmartFilter ? 'Smart' : `${collection.gameCount} games`}
          </span>
        </div>
        {collection.description && (
          <p className="text-xs text-steam-text-muted truncate mt-0.5">
            {collection.description}
          </p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onStartEdit}
          className="p-1.5 text-steam-text-muted hover:text-steam-text transition-colors"
          title="Edit"
          data-testid={`edit-collection-${collection.id}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onConfirmDelete}
          className="p-1.5 text-steam-text-muted hover:text-red-500 transition-colors"
          title="Delete"
          data-testid={`delete-collection-${collection.id}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
