import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SwitchToExecutiveFlowButton from './SwitchToExecutiveFlowButton';

describe('SwitchToExecutiveFlowButton', () => {
  it('offers the new independent design from the classic dashboard', () => {
    const html = renderToStaticMarkup(<SwitchToExecutiveFlowButton />);
    expect(html).toContain('Yeni tasarıma geç');
    expect(html).toContain('AI Akış Merkezi');
  });
});
