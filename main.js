import './style.css';

import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import WMTS from 'ol/source/WMTS';
import XYZ from 'ol/source/XYZ';
import { get as getProjection } from 'ol/proj';
import { getTopLeft, getWidth } from 'ol/extent';

import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import XYZSource from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import { toStringHDMS } from 'ol/coordinate';
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Overlay from 'ol/Overlay';

import { useGeographic } from 'ol/proj.js';

useGeographic();


const projection = getProjection('EPSG:3857');
const projectionExtent = projection.getExtent();
const size = getWidth(projectionExtent) / 256;
const resolutions = [];
const matrixIds = [];

import LayerSwitcher from 'ol-layerswitcher';
import Layer from 'ol/layer/Layer';
import Translate from 'ol/interaction/Translate';
import Collection from 'ol/Collection';


const basemap = new TileLayer({
  title: 'OpenStreetMap',
  type: 'base',
  visible: true,
  source: new OSM()
});

const swissImage = new TileLayer({
  title: 'Luftbild (swissimage)',
  type: 'base',
  source: new XYZ({
    url: `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg`,
  }),
});

const Kaffes = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: './Caffes_Bern.geojson'
  }),
  style: new Style({
    image: new Icon({
      src: './vecteezy_3d-red-map-location-pin-45-degree_73108085.png',
      width: 10,
      height: 10,
      anchor: [0.5, 1]
    })
  })
})
Kaffes.setZIndex(3);

const personFeature = new Feature({
  geometry: new Point([7.440480, 46.948837])
});

const personSource = new VectorSource({
  features: [personFeature]
});


const RADIUS = 100; // Meter (bei useGeographic!)
const RADIUS_DEGREES = RADIUS / 74000; // Convert ~50m to degrees (at Bern latitude)


function countNearby(point) {
  const [cx, cy] = point.getCoordinates();
  return Kaffes.getSource().getFeatures().filter(f => {
    const [fx, fy] = f.getGeometry().getCoordinates();
    return Math.hypot(fx - cx, fy - cy) <= RADIUS_DEGREES;
  }).length;
}

// Global variable to store current count
let currentCount = 0;


const personLayer = new VectorLayer({
  title: 'Person',
  type: 'overlay',
  source: personSource,
  style: (feature) => {
    const gesicht =
      currentCount <= 0 ? './clay-daying.png' :
        currentCount <= 2 ? './clay_mad.png' :
          currentCount <= 4 ? './clay_happy.png' :
            currentCount <= 6 ? './clay_ouyea.png' :
              './clay_tomuch.png';
    return [
      // Person Icon
      new Style({
        image: new Icon({
          src: gesicht,
          scale: 0.15,
          anchor: [0.5, 0.5],
        })
      })
    ];
  }
});

personLayer.setZIndex(4);
const translate = new Translate({
  features: new Collection([personFeature])
});

document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("intro-overlay").remove();

  const personCoord = [7.440480, 46.948837];
  const bubbleElement = document.getElementById('person-bubble');
  const bubbleOverlay = new Overlay({
    element: bubbleElement,
    positioning: 'bottom-center',
    offset: [0, -60], // 👈 über dem Kopf
    stopEvent: true
  });
  map.addOverlay(bubbleOverlay);
  bubbleOverlay.setPosition(personCoord);
});

const text = "Brauchst du Kaffe? \n Verschiebe mich auf einen Ort und finde heraus wie viele Kaffes in der Umgebung hat.";
const typingTarget = document.getElementById("typing-text");

let i = 0;
function typeText() {
  if (i < text.length) {
    typingTarget.innerHTML += text.charAt(i) === '\n' ? '<br>' : text.charAt(i);
    i++;
    setTimeout(typeText, 40);
  }
}
typeText();

typingTarget.style.zIndex = 5;

// Update count and style when translating
translate.on('translating', () => {
  currentCount = countNearby(personFeature.getGeometry());
  const elem = document.getElementById('corner-circle');
  elem.innerHTML = `<span>Anzahl der Kaffes <br> im Umkreis <br> von ${RADIUS}m: ${currentCount}</span>`;

  // Change background color based on count
  if (currentCount <= 0) {
    elem.style.background = 'rgba(255, 255, 255, 0.7)';
  } else if (currentCount <= 2) {
    elem.style.background = 'rgba(211, 218, 166, 0.7)';
  } else if (currentCount <= 4) {
    elem.style.background = 'rgba(183, 211, 174, 0.7)';
  } else if (currentCount <= 6) {
    elem.style.background = 'rgba(218, 166, 166, 0.7)';
  } else {
    elem.style.background = 'rgba(218, 166, 198, 0.7)';
  }
  personSource.changed(); // Force layer to re-render
});


const map = new Map({
  target: 'map',
  layers: [
    basemap, swissImage, Kaffes, personLayer
  ],
  view: new View({
    center: [7.440480, 46.948837],
    zoom: 15
  })
});

const layerSwitcher = new LayerSwitcher({
  activationMode: 'hover', // wie Leaflet
  startActive: false
});
map.addControl(layerSwitcher);
map.addInteraction(translate);

const popupContainer = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

const popup = new Overlay({
  element: popupContainer,
  autoPan: true,
  autoPanAnimation: { duration: 250 },
});

map.addOverlay(popup);

popupCloser.onclick = () => {
  popup.setPosition(undefined);
  return false;
};
map.on('singleclick', (evt) => {
  popup.setPosition(undefined);

  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    const name = feature.get('name');
    const website = feature.get('website');

    if (name) {
      popupContent.innerHTML = `
<strong>${name}</strong><br>
<a href="${website}" target="_blank">Zur Website</a>
`;
      popup.setPosition(evt.coordinate);
    }
  });
});
popupContainer.style.zIndex = 2;

const coffeeIcon = document.getElementById("coffee-icon");
const slideText = document.getElementById("slide-text");

coffeeIcon.addEventListener("click", () => {
slideText.classList.toggle("show");
});
slideText.style.zIndex = 6;