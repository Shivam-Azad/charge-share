"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

interface RoutingProps {
  start: [number, number];
  end: [number, number];
  map: L.Map;
}

export default function RoutingControl({ start, end, map }: RoutingProps) {
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !start || !end) return;

    const safeRemove = (control: any) => {
      if (!control) return;
      try {
        if (control.getPlan()) control.setWaypoints([]);
        if (control._map && map) map.removeControl(control);
      } catch (e) {
        console.debug("Routing cleanup.");
      }
    };

    safeRemove(routingControlRef.current);

    const control = (L as any).Routing.control({
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1]),
      ],
      lineOptions: {
        styles: [
          { color: '#ffffff', weight: 9, opacity: 0.12 },
          { color: '#1a73e8', weight: 5, opacity: 1 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: false,
      draggableWaypoints: false,
      createMarker: () => null,
    }).addTo(map);

    routingControlRef.current = control;

    return () => {
      if (routingControlRef.current) {
        safeRemove(routingControlRef.current);
        routingControlRef.current = null;
      }
    };
  }, [map, start, end]);

  return null;
}