import commentIcon from '../../img/icons/poi-comment.png';
import commentIconLight from '../../img/icons/poi-comment--light.png';

import bikeparkingIcon from '../../img/icons/poi-bikeparking.png';
import bikeparkingIconLight from '../../img/icons/poi-bikeparking--light.png';
import bikeparkingIcon2x from '../../img/icons/poi-bikeparking@2x.png';
import bikeparkingIconMini from '../../img/icons/poi-bikeparking-mini.png';
import bikeparkingIconMiniLight from '../../img/icons/poi-bikeparking-mini--light.png';

import bikeshopIcon from '../../img/icons/poi-bikeshop.png';
import bikeshopIconLight from '../../img/icons/poi-bikeshop--light.png';
import bikeshopIcon2x from '../../img/icons/poi-bikeshop@2x.png';
import bikeshopIconMini from '../../img/icons/poi-bikeshop-mini.png';
import bikeshopIconMiniLight from '../../img/icons/poi-bikeshop-mini--light.png';

import bikerentalIcon from '../../img/icons/poi-bikerental.png';
import bikerentalIconLight from '../../img/icons/poi-bikerental--light.png';
import bikerentalIcon2x from '../../img/icons/poi-bikerental@2x.png';
import bikerentalIconMini from '../../img/icons/poi-bikerental-mini.png';
import bikerentalIconMiniLight from '../../img/icons/poi-bikerental-mini--light.png';

import arrowSdf from '../../img/icons/arrow-sdf.png';
import arrowCiclovia from '../../img/icons/arrow-ciclovia.png';
import arrowCicloviaLight from '../../img/icons/arrow-ciclovia--light.png';
import arrowCiclofaixa from '../../img/icons/arrow-ciclofaixa.png';
import arrowCiclofaixaLight from '../../img/icons/arrow-ciclofaixa--light.png';

export const arrowIconsByLayer: Record<string, string> = {
  Ciclovia: 'arrow-ciclovia',
  'Calçada compartilhada': 'arrow-ciclovia',
  Ciclofaixa: 'arrow-ciclofaixa',
  Ciclorrota: 'arrow-ciclofaixa',
};

export const iconsMap: Record<string, string> = {
  'poi-comment': commentIcon,
  'poi-comment--light': commentIconLight,
  'poi-bikeparking': bikeparkingIcon,
  'poi-bikeparking--light': bikeparkingIconLight,
  'poi-bikeparking-2x': bikeparkingIcon2x,
  'poi-bikeparking-mini': bikeparkingIconMini,
  'poi-bikeparking-mini--light': bikeparkingIconMiniLight,
  'poi-bikeshop': bikeshopIcon,
  'poi-bikeshop--light': bikeshopIconLight,
  'poi-bikeshop-2x': bikeshopIcon2x,
  'poi-bikeshop-mini': bikeshopIconMini,
  'poi-bikeshop-mini--light': bikeshopIconMiniLight,
  'poi-rental': bikerentalIcon,
  'poi-rental--light': bikerentalIconLight,
  'poi-rental-2x': bikerentalIcon2x,
  'poi-rental-mini': bikerentalIconMini,
  'poi-rental-mini--light': bikerentalIconMiniLight,
};

export const arrowIcons: Record<string, string> = {
  'arrow-ciclovia': arrowCiclovia,
  'arrow-ciclovia--light': arrowCicloviaLight,
  'arrow-ciclofaixa': arrowCiclofaixa,
  'arrow-ciclofaixa--light': arrowCiclofaixaLight,
};

export { arrowSdf };
