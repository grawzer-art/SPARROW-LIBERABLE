import { describe, expect, it, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { ToastProvider } from '../src/lib/toast';
import { ConfirmProvider } from '../src/lib/confirm';
import { getDB, listCampaigns } from '../src/db/db';

// jsdom n'implémente pas ResizeObserver (utilisé par la scène du QG).
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

function app(path: string) {
  return render(
    <ToastProvider><ConfirmProvider><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></ConfirmProvider></ToastProvider>,
  );
}
beforeEach(async () => {
  cleanup();
  const db = await getDB();
  await db.clear('campaigns');
  await db.clear('assets');
});

describe('QG et navigation', () => {
  it('propose les cinq postes et LECA CORE dans la navigation alternative', () => {
    app('/');
    const dock = screen.getByRole('navigation', { name: /accès rapide/i });
    for (const n of ['CREATIVE', 'SOCIAL', 'FINANCE', 'SHOP', 'BOOKING', 'CORE']) {
      expect(dock).toHaveTextContent(n);
    }
  });
  it('un poste non développé le dit honnêtement', () => {
    app('/finance');
    expect(screen.getByText(/en développement/i)).toBeInTheDocument();
    expect(screen.getByText(/jamais un bénéfice comptable net/i)).toBeInTheDocument();
  });
  it('LECA CORE affiche qu’aucune IA n’est connectée', () => {
    app('/core');
    expect(screen.getByText(/aucune ia externe connectée/i)).toBeInTheDocument();
  });
});

describe('Creative : création et sauvegarde d’une campagne', () => {
  it('crée une campagne et l’enregistre dans IndexedDB', async () => {
    const user = userEvent.setup();
    app('/creative');
    expect(await screen.findByText(/aucune campagne pour l’instant/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/nom de la campagne/i), 'Lancement ProBond');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(document.getElementById('c-name')).toHaveValue('Lancement ProBond'));
    fireEvent.change(screen.getByLabelText('Objectif'), { target: { value: 'Faire connaître la colle' } });
    await waitFor(async () => {
      const [c] = await listCampaigns();
      expect(c?.objective).toBe('Faire connaître la colle');
    }, { timeout: 3000 });
    expect(await screen.findByText(/enregistré sur cet appareil/i)).toBeInTheDocument();
  });
});
