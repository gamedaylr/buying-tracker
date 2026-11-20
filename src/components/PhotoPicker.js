import React from 'react';

export default function PhotoPicker({ label, hint, files, onChange, multiple, limit }) {
  const cap = limit || (multiple ? 8 : 2);

  function add(event) {
    const picked = Array.from(event.target.files || []);
    const next = [...files];
    picked.forEach((file) => {
      next.push({
        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}-${next.length}`,
        file,
        url: URL.createObjectURL(file),
      });
    });
    onChange(next.slice(0, cap));
    event.target.value = '';
  }

  function remove(id) {
    const target = files.find((file) => file.id === id);
    if (target && target.url) URL.revokeObjectURL(target.url);
    onChange(files.filter((file) => file.id !== id));
  }

  return (
    <div className="photo-field">
      <div className="photo-head">
        <strong>{label}</strong>
        {hint ? <p className="hint">{hint}</p> : null}
      </div>
      <div className="photo-actions">
        <label className="btn btn-ghost">
          Take photo
          <input type="file" accept="image/*" capture="environment" onChange={add} />
        </label>
        <label className="btn btn-ghost">
          {multiple ? 'Choose photos' : 'Choose a photo'}
          <input type="file" accept="image/*" multiple={Boolean(multiple)} onChange={add} />
        </label>
      </div>
      {files.length > 0 && (
        <div className="thumbs">
          {files.map((file) => (
            <figure key={file.id}>
              <img src={file.url} alt="" />
              <button type="button" onClick={() => remove(file.id)}>Remove</button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
