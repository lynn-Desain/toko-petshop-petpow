import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  InfoWindow,
  Pin,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Store, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LatLng } from '../lib/types';

export interface MapMarkerItem {
  id: string;
  position: LatLng;
  title: string;
  subtitle: string;
  kind: 'store' | 'courier' | 'destination' | 'user';
}

interface RouteOverlayProps {
  points: LatLng[];
}

interface GoogleMapsNamespace {
  maps?: {
    Polyline: new (opts: {
      path: LatLng[];
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      map: unknown;
    }) => { setMap: (m: unknown) => void };
    LatLngBounds: new () => { extend: (pt: LatLng) => void };
  };
}

function getGoogleMaps(): GoogleMapsNamespace | undefined {
  return (window as unknown as { google?: GoogleMapsNamespace }).google;
}

function RoutePolylineOverlay({ points }: RouteOverlayProps) {
  const map = useMap();

  useEffect(() => {
    const g = getGoogleMaps();
    if (!map || points.length < 2 || !g?.maps?.Polyline || !g.maps.LatLngBounds) {
      return;
    }

    const line = new g.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: '#EC4899',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });

    const bounds = new g.maps.LatLngBounds();
    points.forEach((pt) => bounds.extend(pt));
    (map as unknown as { fitBounds?: (b: unknown, p: number) => void }).fitBounds?.(bounds, 56);

    return () => {
      line.setMap(null);
    };
  }, [map, points]);

  return null;
}

function MapStatusGuard({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

interface GoogleMapsViewProps {
  apiKey: string;
  center: LatLng;
  zoom?: number;
  markers: MapMarkerItem[];
  routePoints?: LatLng[];
  heightClassName?: string;
}

type AdvancedMarkerInstance = NonNullable<
  React.ComponentRef<typeof AdvancedMarker>
>;

export function GoogleMapsView({
  apiKey,
  center,
  zoom = 12,
  markers,
  routePoints = [],
  heightClassName = 'h-[360px]',
}: GoogleMapsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markerInstances, setMarkerInstances] = useState<
    Record<string, AdvancedMarkerInstance | null>
  >({});

  const selectedMarker = useMemo(
    () => markers.find((m) => m.id === selectedId) || null,
    [markers, selectedId]
  );

  const fallbackView = (
    <div
      data-testid="maps-fallback-canvas"
      className={`${heightClassName} w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 flex flex-col justify-between relative overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-2 z-10">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span>Peta Rute &amp; Koordinat Aktif</span>
        </div>
        <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
          {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </span>
      </div>

      {/* Interactive coordinate grid visualization */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 my-auto py-3 z-10">
        {markers.map((m) => (
          <div
            key={m.id}
            className="p-3 rounded-xl bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-700 text-xs shadow-xs"
          >
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              {m.kind === 'courier' ? (
                <Truck className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
              ) : m.kind === 'store' ? (
                <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className="truncate">{m.title}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{m.subtitle}</p>
            <p className="font-mono-num text-[11px] text-blue-600 dark:text-blue-400 mt-1.5">
              {m.position.lat.toFixed(4)}, {m.position.lng.toFixed(4)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 z-10">
        Menampilkan pin lokasi real-time. Klik alamat cabang untuk membuka rute di Google Maps.
      </p>
    </div>
  );

  if (!apiKey) {
    return fallbackView;
  }

  return (
    <div
      data-testid="google-maps-container"
      className={`${heightClassName} w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 relative`}
    >
      <APIProvider apiKey={apiKey} libraries={['marker', 'routes']} language="id" region="ID">
        <MapStatusGuard fallback={fallbackView}>
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={center}
            defaultZoom={zoom}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {routePoints.length >= 2 && <RoutePolylineOverlay points={routePoints} />}

            {markers.map((m) => {
              const pinStyle =
                m.kind === 'courier'
                  ? { background: '#EC4899', borderColor: '#BE185D', glyphColor: '#FFFFFF' }
                  : m.kind === 'store'
                    ? { background: '#2563EB', borderColor: '#1D4ED8', glyphColor: '#FFFFFF' }
                    : m.kind === 'user'
                      ? { background: '#0EA5E9', borderColor: '#0369A1', glyphColor: '#FFFFFF' }
                      : { background: '#10B981', borderColor: '#047857', glyphColor: '#FFFFFF' };

              return (
                <AdvancedMarker
                  key={m.id}
                  ref={(el) => {
                    if (el && markerInstances[m.id] !== el) {
                      setMarkerInstances((prev) => ({ ...prev, [m.id]: el }));
                    }
                  }}
                  position={m.position}
                  title={m.title}
                  onClick={() => setSelectedId(m.id)}
                >
                  <Pin
                    background={pinStyle.background}
                    borderColor={pinStyle.borderColor}
                    glyphColor={pinStyle.glyphColor}
                  />
                </AdvancedMarker>
              );
            })}

            {selectedMarker && markerInstances[selectedMarker.id] && (
              <InfoWindow
                anchor={markerInstances[selectedMarker.id]}
                onCloseClick={() => setSelectedId(null)}
                maxWidth={240}
              >
                <div className="p-1 text-slate-900">
                  <p className="font-bold text-xs">{selectedMarker.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{selectedMarker.subtitle}</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </MapStatusGuard>
      </APIProvider>
    </div>
  );
}
