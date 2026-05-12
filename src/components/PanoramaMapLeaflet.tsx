"use client";

import { useEffect, useRef } from "react";
import L, { LatLngExpression } from "leaflet";
import "leaflet-defaulticon-compatibility";
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

export interface CityMarkerData {
  city: string;
  position: LatLngExpression;
  coletas: number;
  entregas: number;
}

interface PanoramaMapLeafletProps {
  markers: CityMarkerData[];
  onMarkerClick: (city: string, action: 'coleta' | 'entrega') => void;
  isDark: boolean;
}

export default function PanoramaMapLeaflet({
  markers,
  onMarkerClick,
  isDark
}: PanoramaMapLeafletProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const center: LatLngExpression = [-14.235, -51.9253]; // Brazil Center
  const zoom = 4;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use a lighter/darker tile layer based on isDark theme
    const tileUrl = isDark 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
        maxZoom: 12,
        minZoom: 3,
    });

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isDark]);

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;
    
    markersLayerRef.current.clearLayers();

    markers.forEach((marker) => {
        const hasColetas = marker.coletas > 0;
        const hasEntregas = marker.entregas > 0;

        // Create HTML content for the marker
        let htmlContent = `<div style="display: flex; gap: 4px; padding: 4px; background: ${isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}; border-radius: 20px; border: 1px solid ${isDark ? '#444' : '#e5e7eb'}; backdrop-filter: blur(4px); white-space: nowrap;">`;
        
        if (hasColetas) {
            htmlContent += `<div onclick="window.handleMarkerClick('${marker.city.replace(/'/g, "\\'")}', 'coleta')" style="cursor: pointer; background-color: #16a34a; color: white; border-radius: 50%; min-width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; box-shadow: 0 2px 4px rgba(22,163,74,0.4);" title="Ver Coletas em ${marker.city}">${marker.coletas}C</div>`;
        }
        
        if (hasEntregas) {
             htmlContent += `<div onclick="window.handleMarkerClick('${marker.city.replace(/'/g, "\\'")}', 'entrega')" style="cursor: pointer; background-color: #2563eb; color: white; border-radius: 50%; min-width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; box-shadow: 0 2px 4px rgba(37,99,235,0.4);" title="Ver Entregas em ${marker.city}">${marker.entregas}E</div>`;
        }

        htmlContent += `</div>`;

        // Calculate icon dimensions based on content
        const iconWidth = (hasColetas ? 28 : 0) + (hasEntregas ? 28 : 0) + (hasColetas && hasEntregas ? 12 : 8);

        const customIcon = L.divIcon({
            html: htmlContent,
            className: 'panorama-map-icon', // Just to stop default styles
            iconSize: [iconWidth, 36],
            iconAnchor: [iconWidth / 2, 18],
        });

        const leafletMarker = L.marker(marker.position, { icon: customIcon });

        // Add a small tooltip native to leaflet for the city name on hover
        leafletMarker.bindTooltip(marker.city, {
            direction: 'top',
            offset: [0, -18],
            className: 'bg-popover text-popover-foreground border-border text-sm font-semibold shadow-sm'
        });

        leafletMarker.addTo(markersLayerRef.current!);
    });

  }, [markers, isDark]);

  // Expose click handler to window context so inline onclick string in Leaflet div can call it
  useEffect(() => {
     (window as any).handleMarkerClick = (city: string, action: 'coleta' | 'entrega') => {
         onMarkerClick(city, action);
     };
     return () => {
         delete (window as any).handleMarkerClick;
     }
  }, [onMarkerClick]);


  return (
    <div className="h-full w-full rounded-lg overflow-hidden border bg-muted">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
