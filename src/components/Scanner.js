import React, { useEffect, useRef, useState } from 'react';
import { BarcodeFormat, BrowserMultiFormatReader, BrowserPDF417Reader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';

export default function Scanner({ title, mode, onResult, onClose }) {
  const videoRef = useRef(null);
  const onResultRef = useRef(onResult);
  const [error, setError] = useState('');
  onResultRef.current = onResult;

  useEffect(() => {
    let controls;
    let stopped = false;
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    const Reader = mode === 'license' ? BrowserPDF417Reader : BrowserMultiFormatReader;
    if (mode !== 'license') {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.PDF_417,
        BarcodeFormat.DATA_MATRIX,
      ]);
    }
    const reader = new Reader(hints, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 500 });
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _decodeError, nextControls) => {
      controls = nextControls;
      if (result && !stopped) {
        stopped = true;
        nextControls.stop();
        onResultRef.current(result.getText());
      }
    }).catch(() => {
      if (!stopped) setError('The camera did not start. You can type the details instead. On an iPhone, allow camera access for this site.');
    });
    return () => {
      stopped = true;
      if (controls) controls.stop();
    };
  }, [mode]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card">
        <h2>{title}</h2>
        <p className="hint">
          {mode === 'license'
            ? 'Point the camera at the barcode on the back of the ID. The photo of the ID is still required when the dollar rule says so.'
            : 'Point the camera at the barcode or QR code on the slab.'}
        </p>
        <video ref={videoRef} className="scanner-video" muted playsInline />
        {error ? <p className="banner warn">{error}</p> : null}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close camera</button>
      </div>
    </div>
  );
}
