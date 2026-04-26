import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Asset,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

import { apiFetch, DEFAULT_API_HOST } from '../../utils/api';
import { useTheme } from '../../theme/useTheme';
import { CoffeeBeanIcon } from '../icons';
import { MD3Button } from '../md3';

const PICKER_TIMEOUT_MS = 2000000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) =>
  Math.ceil((base64.length * 3) / 4);

const normalizeBase64 = (value: string) =>
  value.replace(/^data:image\/\w+;base64,/, '').trim();

type InventoryCoffee = {
  id: string;
  rawText: string | null;
  correctedText: string | null;
  labelImageBase64: string | null;
  hasImage?: boolean;
  status: 'active' | 'empty' | 'archived';
};

type Props = {
  hasImage: boolean;
  onImageSelected: (base64: string, infoMessage?: string) => void;
  onError: (message: string) => void;
};

function PhotoInputCard({ hasImage, onImageSelected, onError }: Props) {
  const { colors, typescale, shape, elevation: elev, spacing } = useTheme();
  const [isPicking, setIsPicking] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryCoffee[]>([]);
  const [isInventoryVisible, setIsInventoryVisible] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [loadingInventoryItemId, setLoadingInventoryItemId] = useState<string | null>(null);

  const withPickerTimeout = useCallback(async <T,>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error('Image picker timed out.'));
        }, PICKER_TIMEOUT_MS);
      }),
    ]),
  []);

  const handlePickerResponse = useCallback((response: ImagePickerResponse) => {
    if (response.didCancel) {
      onError('Výber bol zrušený.');
      return;
    }
    if (response.errorCode) {
      onError(response.errorMessage || 'Nastala chyba pri výbere obrázka.');
      return;
    }
    const asset: Asset | undefined = response.assets?.[0];
    if (!asset?.base64) {
      onError('Nepodarilo sa načítať obrázok. Skúste znova.');
      return;
    }
    const normalizedImage = normalizeBase64(asset.base64);
    if (estimateBase64Bytes(normalizedImage) > MAX_BASE64_BYTES) {
      onError('Obrázok je stále príliš veľký. Skúste menší záber alebo iný súbor.');
      return;
    }
    setIsInventoryVisible(false);
    onImageSelected(normalizedImage);
  }, [onError, onImageSelected]);

  const handleSelectFromGallery = useCallback(async () => {
    setIsPicking(true);
    try {
      const response = await withPickerTimeout(
        launchImageLibrary({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
        }),
      );
      handlePickerResponse(response);
    } catch {
      onError('Načítanie obrázka trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  }, [withPickerTimeout, handlePickerResponse, onError]);

  const handleTakePhoto = useCallback(async () => {
    setIsPicking(true);
    try {
      const response = await withPickerTimeout(
        launchCamera({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
          saveToPhotos: true,
        }),
      );
      handlePickerResponse(response);
    } catch {
      onError('Načítanie fotky trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  }, [withPickerTimeout, handlePickerResponse, onError]);

  const loadInventory = useCallback(async () => {
    if (isInventoryLoading) {
      return;
    }
    setIsInventoryLoading(true);
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/user-coffee`,
        { method: 'GET', credentials: 'include' },
        { feature: 'PhotoRecipe', action: 'inventory-load' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodarilo sa načítať inventár.');
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setInventoryItems(items.filter((item: InventoryCoffee) => item.status === 'active'));
      setIsInventoryVisible(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Nepodarilo sa načítať inventár.');
    } finally {
      setIsInventoryLoading(false);
    }
  }, [isInventoryLoading, onError]);

  const handleSelectInventoryCoffee = useCallback(async (item: InventoryCoffee) => {
    const itemHasImage = item.hasImage ?? Boolean(item.labelImageBase64);
    if (!itemHasImage) {
      onError('Táto káva v inventári nemá uloženú fotku etikety.');
      return;
    }

    let rawImage = item.labelImageBase64;
    if (!rawImage) {
      setLoadingInventoryItemId(item.id);
      try {
        const response = await apiFetch(
          `${DEFAULT_API_HOST}/api/user-coffee/${item.id}/image`,
          { method: 'GET', credentials: 'include' },
          { feature: 'PhotoRecipe', action: 'inventory-image-load' },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Nepodarilo sa načítať fotku etikety.');
        }
        if (typeof payload?.imageBase64 === 'string' && payload.imageBase64.length > 0) {
          rawImage = payload.imageBase64 as string;
        } else if (typeof payload?.url === 'string' && payload.url.length > 0) {
          // Storage-resident image — fetch the signed URL and convert to base64.
          const blobResp = await fetch(payload.url);
          if (!blobResp.ok) {
            throw new Error('Nepodarilo sa stiahnuť fotku z úložiska.');
          }
          const blob = await blobResp.blob();
          rawImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error('FileReader failed.'));
            reader.onload = () => {
              const result = reader.result;
              resolve(typeof result === 'string' ? result : '');
            };
            reader.readAsDataURL(blob);
          });
        } else {
          throw new Error(payload?.error || 'Nepodarilo sa načítať fotku etikety.');
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Nepodarilo sa načítať fotku etikety.');
        return;
      } finally {
        setLoadingInventoryItemId(null);
      }
    }

    const normalizedImage = normalizeBase64(rawImage);
    if (estimateBase64Bytes(normalizedImage) > MAX_BASE64_BYTES) {
      onError('Fotka etikety tejto kávy je príliš veľká na analýzu.');
      return;
    }
    const coffeeName = item.correctedText || item.rawText || 'káva z inventára';
    setIsInventoryVisible(false);
    onImageSelected(normalizedImage, `Vybraná ${coffeeName}. Teraz môžeš spustiť analýzu.`);
  }, [onError, onImageSelected]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: shape.extraLarge,
          padding: spacing.lg,
          ...elev.level1.shadow,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        cardTitle: {
          ...typescale.titleSmall,
          color: colors.onSurface,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        inventoryList: {
          marginTop: spacing.md,
          gap: spacing.sm,
        },
        inventoryItem: {
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          padding: spacing.md,
        },
        inventoryItemDisabled: {
          opacity: 0.5,
        },
        inventoryItemTitle: {
          ...typescale.labelLarge,
          color: colors.onSurface,
        },
        inventoryItemMeta: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.xs,
        },
        helperText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
      }),
    [colors, typescale, shape, elev, spacing],
  );

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <CoffeeBeanIcon size={20} color={colors.primary} />
        <Text style={s.cardTitle}>Fotografia kávy</Text>
      </View>
      <View style={s.buttonRow}>
        <MD3Button
          label="Vybrať z galérie"
          variant="outlined"
          onPress={handleSelectFromGallery}
          disabled={isPicking}
          style={{ flex: 1 }}
        />
        <MD3Button
          label="Odfotiť"
          variant="tonal"
          onPress={handleTakePhoto}
          disabled={isPicking}
          style={{ flex: 1 }}
        />
      </View>
      <MD3Button
        label={isInventoryLoading ? 'Načítavam inventár…' : 'Vybrať fotku z inventára'}
        variant="outlined"
        onPress={loadInventory}
        disabled={isInventoryLoading || isPicking}
        loading={isInventoryLoading}
        style={{ marginTop: spacing.md }}
      />

      {isInventoryVisible ? (
        <View style={s.inventoryList}>
          {inventoryItems.length > 0 ? (
            inventoryItems.map(item => {
              const coffeeName = item.correctedText || item.rawText || 'Neznáma káva';
              const hasItemImage = item.hasImage ?? Boolean(item.labelImageBase64);
              const isLoadingThis = loadingInventoryItemId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[s.inventoryItem, !hasItemImage && s.inventoryItemDisabled]}
                  onPress={() => handleSelectInventoryCoffee(item)}
                  disabled={!hasItemImage || isLoadingThis}
                >
                  <Text style={s.inventoryItemTitle}>{coffeeName}</Text>
                  <Text style={s.inventoryItemMeta}>
                    {isLoadingThis
                      ? 'Načítavam fotku…'
                      : hasItemImage
                        ? 'Použiť fotku etikety z inventára'
                        : 'Bez fotky etikety'}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={s.helperText}>V inventári nemáš žiadnu aktívnu kávu.</Text>
          )}
        </View>
      ) : null}
      <Text style={s.helperText}>
        {hasImage ? 'Fotka je pripravená.' : 'Zatiaľ nie je vybraná žiadna fotka.'}
      </Text>
    </View>
  );
}

export default React.memo(PhotoInputCard);
