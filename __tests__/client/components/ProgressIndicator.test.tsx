import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ProgressIndicator } from '../../../src/components/ProgressIndicator';

jest.mock('../../../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6B4F3A',
      onPrimary: '#FFFFFF',
      primaryContainer: '#EECAAE',
      onSurfaceVariant: '#4B4339',
    },
    spacing: { xs: 4, sm: 8, md: 12 },
    shape: { full: 9999 },
    typescale: {
      bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
      labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
    },
    isDark: false,
  }),
}));

describe('ProgressIndicator', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  afterEach(() => {
    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it('renders in determined mode with correct accessibility value', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<ProgressIndicator progress={50} />);
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestRendererJSON;
    expect(root.props.accessibilityRole).toBe('progressbar');
    expect(root.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it('renders in indeterminate mode without accessibilityValue', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<ProgressIndicator />);
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestRendererJSON;
    expect(root.props.accessibilityRole).toBe('progressbar');
    expect(root.props.accessibilityValue).toBeUndefined();
  });

  it('track view has onLayout handler wired for indeterminate animation', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<ProgressIndicator />);
    });
    // onLayout must be present so the component can measure trackWidth
    // and switch from hidden state to the native-driver translateX animation.
    const trackViews = renderer.root.findAll(el => el.props.onLayout != null);
    expect(trackViews.length).toBeGreaterThanOrEqual(1);
  });

  it('renders stageLabel when provided', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ProgressIndicator stageLabel="Spracúvam OCR" />,
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Spracúvam OCR');
  });

  it('renders elapsedLabel when provided', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ProgressIndicator elapsedLabel="Trvanie: 2.3 s" />,
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Trvanie: 2.3 s');
  });

  it('renders both stageLabel and elapsedLabel together', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ProgressIndicator
          progress={75}
          stageLabel="Tvorím chuťový profil"
          elapsedLabel="Trvanie: 5.0 s"
        />,
      );
    });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Tvorím chuťový profil');
    expect(text).toContain('Trvanie: 5.0 s');
  });

  it('does not render text nodes when no labels provided', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<ProgressIndicator progress={30} />);
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestRendererJSON;
    const countTextNodes = (
      node: ReactTestRenderer.ReactTestRendererJSON,
    ): number => {
      if (!node.children) return 0;
      return node.children.reduce<number>((acc, child) => {
        if (typeof child === 'string') return acc + 1;
        return acc + countTextNodes(child);
      }, 0);
    };
    expect(countTextNodes(root)).toBe(0);
  });

  it('renders onPrimary variant with correct accessibility value', async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ProgressIndicator
          progress={60}
          variant="onPrimary"
          stageLabel="Nahrávam obrázok"
          elapsedLabel="Trvanie: 1.2 s"
        />,
      );
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestRendererJSON;
    expect(root.props.accessibilityRole).toBe('progressbar');
    expect(root.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 60,
    });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Nahrávam obrázok');
    expect(text).toContain('Trvanie: 1.2 s');
  });
});
