"use client";

import { useEffect, useRef } from "react";
import L, { LatLngExpression } from "leaflet";
import "leaflet-defaulticon-compatibility";

interface MarkerData {
  position: LatLngExpression;
  name: string;
}

interface MapDisplayLeafletProps {
  center: LatLngExpression;
  zoom: number;
  routeGeometry?: LatLngExpression[];
  markers?: MarkerData[];
}

export default function MapDisplayLeaflet({
  center,
  zoom,
  routeGeometry = [],
  markers = [],
}: MapDisplayLeafletProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Inicializa o mapa uma única vez
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    routeLayerRef.current = L.polyline([], { color: "#2563eb", weight: 5, opacity: 0.8 }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom]);

  // Atualiza rota e marcadores
  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current || !markersLayerRef.current) return;
    
    // Update route
    routeLayerRef.current.setLatLngs(routeGeometry);
    
    // Update markers
    markersLayerRef.current.clearLayers();
    markers.forEach((marker, index) => {
        const iconHtml = `<div style="background-color: #2563eb; color: white; border-radius: 50%; width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${index + 1}</div>`;
        
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-leaflet-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

      L.marker(marker.position, { icon: customIcon })
        .bindPopup(marker.name)
        .addTo(markersLayerRef.current!);
    });

    // Fit bounds
    if (routeGeometry.length > 0) {
        mapRef.current.fitBounds(routeGeometry as L.LatLngBoundsExpression, { padding: [25, 25] });
    } else if (markers.length > 0) {
        const markerBounds = L.latLngBounds(markers.map(m => m.position as L.LatLngTuple));
        mapRef.current.fitBounds(markerBounds, { padding: [25, 25] });
    }

  }, [routeGeometry, markers]);

  return (
    <div className="h-full w-full rounded-lg overflow-hidden border">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
