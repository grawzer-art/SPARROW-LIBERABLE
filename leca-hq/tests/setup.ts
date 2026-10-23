import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob } from 'node:buffer';

// fake-indexeddb clone les valeurs avec le structuredClone de Node : on aligne Blob pour que les
// objets stockés restent de vrais Blob (comportement des navigateurs).
globalThis.Blob = NodeBlob as unknown as typeof Blob;
