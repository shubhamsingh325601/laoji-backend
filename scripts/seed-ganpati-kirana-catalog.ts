import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

interface ProductSpec {
  name: string;
  brand: string | null;
  unit: string;
  size?: string;
  mrp: number;
  price: number;
  description: string;
  imageUrl?: string;
}

interface CategoryData {
  name: string;
  imageUrl: string;
  items: ProductSpec[];
}

const CATEGORIES_DATA: CategoryData[] = [
  {
    name: 'Personal Care / Bath & Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
    items: [
      {
        name: 'Lux Bath & Body Soap',
        brand: 'Lux',
        unit: 'piece',
        size: '100 g',
        mrp: 40,
        price: 38,
        description: 'Fragrant bathing soap bar enriched with beauty oils for soft skin.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Dettol Original Soap',
        brand: 'Dettol',
        unit: 'piece',
        size: '75 g',
        mrp: 40,
        price: 38,
        description: 'Antibacterial bathing soap offering trusted germ protection.',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
      },
      {
        name: 'Ghadi Detergent Cake',
        brand: 'Ghadi',
        unit: 'piece',
        size: '150 g',
        mrp: 15,
        price: 14,
        description: 'Pehle istemal karein phir vishwas karein - fabric detergent bar.',
        imageUrl: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=500',
      },
      {
        name: 'Ghadi Detergent Bar (Family Pack)',
        brand: 'Ghadi',
        unit: 'piece',
        size: '250 g',
        mrp: 25,
        price: 23,
        description: 'Long lasting dirt-removing detergent laundry soap bar.',
        imageUrl: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=500',
      },
      {
        name: 'Rexona Skin Care Soap',
        brand: 'Rexona',
        unit: 'piece',
        size: '100 g',
        mrp: 35,
        price: 33,
        description: 'Coconut & olive oil soap for smooth, naturally nourished skin.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Lux Rose & Vitamin E Soap',
        brand: 'Lux',
        unit: 'piece',
        size: '100 g',
        mrp: 38,
        price: 35,
        description: 'Soft, glowing skin soap infused with French rose extracts.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Godrej No. 1 Soap',
        brand: 'No. 1',
        unit: 'piece',
        size: '100 g',
        mrp: 30,
        price: 28,
        description: 'Natural beauty soap enriched with sandalwood and turmeric.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Jetak Best Hair & Body Care',
        brand: 'Jetak Best',
        unit: 'bottle',
        size: '100 ml',
        mrp: 50,
        price: 48,
        description: 'Multi-purpose daily hair and body care solution.',
        imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
      },
    ],
  },
  {
    name: 'Coffee',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
    items: [
      {
        name: 'Vimal Instant Coffee',
        brand: 'Vimal',
        unit: 'pouch',
        size: '50 g',
        mrp: 60,
        price: 55,
        description: 'Rich roasted aromatic coffee blend for instant refreshment.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
      {
        name: 'Compact Coffee',
        brand: 'Compact',
        unit: 'pouch',
        size: '50 g',
        mrp: 50,
        price: 48,
        description: 'Strong aromatic coffee powder for rich hot and cold coffee.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
      {
        name: 'Excellent Special Coffee',
        brand: 'Excellent',
        unit: 'jar',
        size: '50 g',
        mrp: 75,
        price: 70,
        description: 'Premium blend coffee with distinct aroma and robust taste.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
      {
        name: 'Nika Classic Coffee',
        brand: 'Nika',
        unit: 'pouch',
        size: '50 g',
        mrp: 50,
        price: 45,
        description: 'Finely roasted coffee beans powder for quick morning energy.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
      {
        name: 'Achak Coffee',
        brand: 'Achak',
        unit: 'pouch',
        size: '50 g',
        mrp: 45,
        price: 42,
        description: 'Traditional style coffee powder with smooth balanced flavor.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
      {
        name: 'Jetak Best Instant Coffee',
        brand: 'Jetak Best',
        unit: 'pouch',
        size: '50 g',
        mrp: 50,
        price: 48,
        description: 'Rich roasted instant coffee blend.',
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
      },
    ],
  },
  {
    name: 'Hair / Amla / Hair Oils',
    imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
    items: [
      {
        name: 'Shanti Amla Hair Oil',
        brand: 'Shanti',
        unit: 'bottle',
        size: '100 ml',
        mrp: 45,
        price: 42,
        description: 'Ayurvedic amla hair oil for strong, black and shiny hair.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Almond Hair Oil (बादाम तेल)',
        brand: null,
        unit: 'bottle',
        size: '100 ml',
        mrp: 70,
        price: 65,
        description: 'Non-sticky pure almond hair oil enriched with Vitamin E.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Dabur Amla Hair Oil',
        brand: 'Dabur',
        unit: 'bottle',
        size: '100 ml',
        mrp: 55,
        price: 50,
        description: 'Original Dabur amla hair oil for deep root nourishment.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Keshav Amla Hair Oil',
        brand: 'Keshav',
        unit: 'bottle',
        size: '100 ml',
        mrp: 45,
        price: 40,
        description: 'Herbal amla oil promoting hair growth and scalp cooling.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Navratna Ayurvedic Cool Hair Oil',
        brand: 'Navratna',
        unit: 'bottle',
        size: '100 ml',
        mrp: 55,
        price: 52,
        description: 'Thanda thanda cool cool oil for relief from headache and stress.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
      {
        name: 'Parachute 100% Pure Coconut Oil',
        brand: 'Marico',
        unit: 'bottle',
        size: '100 ml',
        mrp: 45,
        price: 42,
        description: 'Naturally filtered pure coconut hair oil.',
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-563332158866?w=500',
      },
    ],
  },
  {
    name: 'Tea',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
    items: [
      {
        name: 'Madhushree CTC Tea (चाय)',
        brand: 'Madhushree',
        unit: 'packet',
        size: '250 g',
        mrp: 85,
        price: 80,
        description: 'Aromatic kadak CTC leaf tea for strong daily Indian chai.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
      },
      {
        name: 'Asha Premium Tea',
        brand: 'Asha',
        unit: 'packet',
        size: '250 g',
        mrp: 75,
        price: 70,
        description: 'High garden select tea grains with rich red liquor and taste.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
      },
      {
        name: 'Vijayashree Gold Tea',
        brand: 'Vijayashree',
        unit: 'packet',
        size: '250 g',
        mrp: 80,
        price: 75,
        description: 'Fine quality blend CTC tea for authentic morning tea.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
      },
      {
        name: 'Taj Mahal Tea',
        brand: 'Taj',
        unit: 'packet',
        size: '250 g',
        mrp: 150,
        price: 140,
        description: 'Wah Taj! Exquisite tea crafted with selected tender tea leaves.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
      },
      {
        name: 'Goldie CTC Chai',
        brand: 'Goldie',
        unit: 'packet',
        size: '250 g',
        mrp: 90,
        price: 85,
        description: 'Fresh garden Assam CTC black tea powder.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
      },
    ],
  },
  {
    name: 'Cooking Oils',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500',
    items: [
      {
        name: 'Pure Edible Coconut Oil',
        brand: null,
        unit: 'bottle',
        size: '500 ml',
        mrp: 140,
        price: 130,
        description: 'Cold pressed pure coconut oil for cooking and traditional recipes.',
        imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500',
      },
      {
        name: 'Refined Sunflower Cooking Oil',
        brand: null,
        unit: 'pouch',
        size: '1 L',
        mrp: 135,
        price: 125,
        description: 'Light and healthy refined sunflower oil rich in Vitamin E.',
        imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500',
      },
      {
        name: 'Refined Cottonseed Oil (कपासिया तेल)',
        brand: null,
        unit: 'pouch',
        size: '1 L',
        mrp: 130,
        price: 120,
        description: 'Popular high-smoke point cooking oil for frying and daily meals.',
        imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500',
      },
    ],
  },
  {
    name: 'Spices & Masala',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
    items: [
      {
        name: 'Whole Cumin Seeds (जीरा)',
        brand: null,
        unit: 'packet',
        size: '100 g',
        mrp: 55,
        price: 50,
        description: 'Aromatic clean whole cumin seeds for tempering and tadka.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Whole Cloves (लौंग)',
        brand: null,
        unit: 'packet',
        size: '50 g',
        mrp: 65,
        price: 60,
        description: 'Rich dark aroma whole cloves for curries, masala chai & remedies.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Green Cardamom (हरी इलायची)',
        brand: null,
        unit: 'packet',
        size: '25 g',
        mrp: 85,
        price: 80,
        description: 'Fresh whole green cardamom pods with intense sweet fragrance.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Red Chilli Powder (लाल मिर्च पाउडर)',
        brand: null,
        unit: 'packet',
        size: '200 g',
        mrp: 60,
        price: 55,
        description: 'Pure ground spicy red chilli powder.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Turmeric Powder (हल्दी पाउडर)',
        brand: null,
        unit: 'packet',
        size: '200 g',
        mrp: 55,
        price: 50,
        description: 'Natural golden yellow turmeric powder with rich curcumin.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Coriander Powder (धनिया पाउडर)',
        brand: null,
        unit: 'packet',
        size: '200 g',
        mrp: 50,
        price: 45,
        description: 'Finely ground aromatic coriander seed powder.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Kashmiri Mirch Powder',
        brand: null,
        unit: 'packet',
        size: '100 g',
        mrp: 65,
        price: 60,
        description: 'Mildly spiced Kashmiri red chilli powder for brilliant natural color.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Jeera Masala Powder',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 85,
        price: 80,
        description: 'MDH roasted cumin blended spice powder for raita and snacks.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Chana Masala',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 85,
        price: 80,
        description: 'Authentic spice blend for lip-smacking Punjabi chana curry.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Chhole Masala',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 85,
        price: 80,
        description: 'Special aromatic blend for rich restaurant-style chhole.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Meat Masala',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 90,
        price: 85,
        description: 'Traditional blend of spices for rich gravy curries.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Chunky Chat Masala',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 75,
        price: 70,
        description: 'Tangy and savory seasoning for fruits, salads, snacks and chaat.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'MDH Garam Masala',
        brand: 'MDH',
        unit: 'box',
        size: '100 g',
        mrp: 95,
        price: 90,
        description: 'Royal blend of warm whole ground spices.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Desi Local Garam Masala (हथखोटा)',
        brand: 'Desi/Local',
        unit: 'packet',
        size: '100 g',
        mrp: 60,
        price: 55,
        description: 'Traditional village hand-ground rustic warm garam masala.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Black Salt Powder (काला नमक)',
        brand: null,
        unit: 'packet',
        size: '100 g',
        mrp: 20,
        price: 18,
        description: 'Digestive black mineral salt with distinctive flavor.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
      {
        name: 'Rock Salt (सेंधा नमक / व्रत का नमक)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 35,
        price: 30,
        description: 'Pure unrefined Himalayan rock salt, ideal for fasting/vrat.',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
      },
    ],
  },
  {
    name: 'Dry Fruits',
    imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
    items: [
      {
        name: 'Whole Cashews (काजू साबुत)',
        brand: null,
        unit: 'packet',
        size: '250 g',
        mrp: 240,
        price: 220,
        description: 'Crisp creamy whole white cashews (W320 grade).',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'California Almonds (बादाम गिरी)',
        brand: null,
        unit: 'packet',
        size: '250 g',
        mrp: 230,
        price: 210,
        description: 'Crunchy sweet California almond kernels packed with protein.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Soft Black Dates (काले खजूर)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 120,
        price: 110,
        description: 'Naturally sweet energy-boosting fresh soft dates.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Phool Makhana (फूल मखाना)',
        brand: null,
        unit: 'packet',
        size: '100 g',
        mrp: 95,
        price: 85,
        description: 'Jumbo size crunchy lotus seeds for healthy fasting snacks.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Walnut Kernels (अखरोट गिरी)',
        brand: null,
        unit: 'packet',
        size: '250 g',
        mrp: 320,
        price: 290,
        description: 'Crispy fresh walnut halves rich in Omega-3.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Dried Figs (अंजीर माला)',
        brand: null,
        unit: 'packet',
        size: '200 g',
        mrp: 260,
        price: 240,
        description: 'Natural fibre-rich dried sweet figs.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Pistachios (पिस्ता नमकीन / मगज)',
        brand: null,
        unit: 'packet',
        size: '100 g',
        mrp: 160,
        price: 145,
        description: 'Roasted and salted crunchy whole pistachios.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
      {
        name: 'Golden Raisins / Kishmish (किशमिश)',
        brand: null,
        unit: 'packet',
        size: '250 g',
        mrp: 90,
        price: 80,
        description: 'Juicy sweet seedless green/golden raisins.',
        imageUrl: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=500',
      },
    ],
  },
  {
    name: 'Rice / Flour / Grain',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
    items: [
      {
        name: 'Refined Wheat Flour (मैदा 500g)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 25,
        price: 22,
        description: 'Super fine maida for bhature, samosa, cakes and pastries.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Gram Flour (बेसन 500g)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 55,
        price: 50,
        description: 'Finely milled 100% pure chana dal besan for pakodas & sweets.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Semolina (सूजी / रवा)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 30,
        price: 28,
        description: 'Coarse wheat semolina for halwa, upma, and idli.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Black Rice (काला चावल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 90,
        price: 80,
        description: 'Nutrient-dense antioxidant-rich organic black rice.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'India Gate Basmati Rice Feast Rozzana',
        brand: 'India Gate',
        unit: 'bag',
        size: '1 kg',
        mrp: 110,
        price: 95,
        description: 'Aromatic long-grain basmati rice for daily family meals.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Double Chabi Basmati Rice (1kg)',
        brand: 'Double',
        unit: 'bag',
        size: '1 kg',
        mrp: 120,
        price: 110,
        description: 'Extra long grain traditional Indian basmati rice.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Krishna Bhog Rice',
        brand: 'Krishna',
        unit: 'bag',
        size: '1 kg',
        mrp: 80,
        price: 72,
        description: 'Aromatic small grain sweet fragrance rice for kheer & khichdi.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Basmati Rice Broken / Kanki (चावल कनकी)',
        brand: null,
        unit: 'bag',
        size: '1 kg',
        mrp: 75,
        price: 68,
        description: 'Broken basmati rice grains perfect for daily khichdi and pulao.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Singhara Atta (सिंघाड़ा आटा / उपवास का आटा)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 65,
        price: 60,
        description: 'Pure water chestnut flour for vrat ki poori and pakodi.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Moongfali Dana (मूंगफली दाना 500g)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 70,
        price: 65,
        description: 'Clean sorted raw peanut kernels for snacking and poha.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
    ],
  },
  {
    name: 'Pulses / Dal',
    imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
    items: [
      {
        name: 'Moong Dal Dhuli (धुली मूंग दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 75,
        price: 70,
        description: 'Quick-cooking yellow skinless split mung beans.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Moong Dal Mogar (मूंग मोगर दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 80,
        price: 75,
        description: 'Polished yellow moong dal for Rajasthani mogar ki sabzi.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Urad Dal Dhuli (धुली उड़द दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 85,
        price: 78,
        description: 'White skinless split black gram for idli, dosa & dahi vadas.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Urad Dal Mogar / Chilka (उड़द दाल छिलका)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 80,
        price: 74,
        description: 'Split black gram with partial skin for tasty dal fry.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Masoor Dal (मलका / लाल मसूर दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 55,
        price: 50,
        description: 'Split red lentils, rich in iron, fast cooking and delicious.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Special Panchmel Dal (पंचरत्न मिक्स दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 75,
        price: 68,
        description: 'Traditional blend of 5 healthy lentils for Rajasthani baati.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Toor Dal / Arhar Dal (अरहर दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 90,
        price: 82,
        description: 'Desi unpolished pigeon pea lentils for authentic Indian sambar and dal.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Chana Dal (चना दाल)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 55,
        price: 50,
        description: 'Nutritious split yellow baby chickpeas for dal, halwa and tadka.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Moth Dal / Sabut Matki (मोठ दाल साबुत)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 65,
        price: 60,
        description: 'Whole brown moth beans for sprouts and Rajasthani moth dal.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
      {
        name: 'Whole Green Moong (साबुत मूंग)',
        brand: null,
        unit: 'packet',
        size: '500 g',
        mrp: 70,
        price: 65,
        description: 'Whole green mung beans ideal for healthy breakfast sprouts.',
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?w=500',
      },
    ],
  },
  {
    name: 'Dairy / Sweets / Snacks',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
    items: [
      {
        name: 'Kota Dairy Gold Fresh Milk (500ml)',
        brand: 'Kota Dairy',
        unit: 'pouch',
        size: '500 ml',
        mrp: 34,
        price: 34,
        description: 'Rich creamy standardized fresh milk from Kota Dairy.',
        imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500',
      },
      {
        name: 'Shree Ji Special Mithai (मिठाई)',
        brand: 'Shree Ji',
        unit: 'box',
        size: '250 g',
        mrp: 110,
        price: 100,
        description: 'Pure ghee traditional fresh Indian sweets.',
        imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500',
      },
      {
        name: 'Giridhar Special All-in-One Mixture Namkeen',
        brand: 'Giridhar',
        unit: 'packet',
        size: '250 g',
        mrp: 50,
        price: 45,
        description: 'Crispy savoury spiced teatime mixture namkeen.',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
      },
      {
        name: 'Giridhar Mota Sev (मोटा सेव नमकीन)',
        brand: 'Giridhar',
        unit: 'packet',
        size: '250 g',
        mrp: 50,
        price: 45,
        description: 'Thick crunchy besan sev with ajwain and mild spices.',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
      },
      {
        name: 'Giridhar Barik Sev (बारीक नायलॉन सेव)',
        brand: 'Giridhar',
        unit: 'packet',
        size: '250 g',
        mrp: 50,
        price: 45,
        description: 'Extra thin nylon sev for chaat, poha topping and snacking.',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
      },
      {
        name: 'Giridhar Khatta Meetha Mix (खट्टा मीठा नमकीन)',
        brand: 'Giridhar',
        unit: 'packet',
        size: '250 g',
        mrp: 50,
        price: 45,
        description: 'Delightful blend of sweet and tangy puffed rice, sev and nuts.',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
      },
      {
        name: 'Giridhar Teekha Farsan / Ratlami Sev',
        brand: 'Giridhar',
        unit: 'packet',
        size: '250 g',
        mrp: 50,
        price: 45,
        description: 'Authentic spicy peppery ratlami sev.',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
      },
    ],
  },
  {
    name: 'Sugar / Salt / Basic Grocery',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500',
    items: [
      {
        name: 'Desi Jaggery (देसी गुड़ भेली 1kg)',
        brand: null,
        unit: 'pack',
        size: '1 kg',
        mrp: 60,
        price: 52,
        description: 'Pure chemical-free golden brown sugarcane jaggery.',
        imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
      },
      {
        name: 'White Crystal Sugar (चीनी 1kg)',
        brand: null,
        unit: 'packet',
        size: '1 kg',
        mrp: 48,
        price: 44,
        description: 'Sulphur-free clean sparkling white sugar crystals.',
        imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500',
      },
      {
        name: 'Iodised Table Salt (आयोडीन नमक 1kg)',
        brand: null,
        unit: 'packet',
        size: '1 kg',
        mrp: 25,
        price: 22,
        description: 'Free-flowing refined iodised cooking salt.',
        imageUrl: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=500',
      },
      {
        name: 'No. 1 Pure Refined Salt (1kg)',
        brand: 'No. 1',
        unit: 'packet',
        size: '1 kg',
        mrp: 20,
        price: 18,
        description: 'Economic refined iodised salt pack.',
        imageUrl: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=500',
      },
      {
        name: 'Refined Wheat Flour (मैदा 1kg)',
        brand: null,
        unit: 'packet',
        size: '1 kg',
        mrp: 45,
        price: 40,
        description: 'Bulk 1 kg family pack refined wheat flour.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Pure Chana Besan (बेसन 1kg)',
        brand: null,
        unit: 'packet',
        size: '1 kg',
        mrp: 105,
        price: 95,
        description: '1 kg value pack pure gram flour for home cooking.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
      {
        name: 'Moongfali Dana Peanuts (मूंगफली दाना 1kg)',
        brand: null,
        unit: 'packet',
        size: '1 kg',
        mrp: 135,
        price: 125,
        description: '1 kg value pack raw shelled peanuts.',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500',
      },
    ],
  },
  {
    name: 'Oral Care',
    imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
    items: [
      {
        name: 'Colgate Strong Teeth Dental Cream Toothpaste',
        brand: 'Colgate',
        unit: 'tube',
        size: '100 g',
        mrp: 65,
        price: 60,
        description: 'Calcium boost toothpaste for strong teeth and fresh breath.',
        imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
      },
      {
        name: 'Closeup Everfresh Red Hot Gel Toothpaste',
        brand: 'Closeup',
        unit: 'tube',
        size: '80 g',
        mrp: 60,
        price: 55,
        description: 'Anti-bacterial zinc mouthwash gel toothpaste with 12hr fresh breath.',
        imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
      },
      {
        name: 'Dabur Babool Ayurvedic Toothpaste',
        brand: 'Babool',
        unit: 'tube',
        size: '100 g',
        mrp: 45,
        price: 40,
        description: 'Time-tested babbool extracts for healthy gums and tight teeth.',
        imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
      },
      {
        name: 'Megha Herbal Tooth Powder (दंत मंजन 100g)',
        brand: 'Megha',
        unit: 'container',
        size: '100 g',
        mrp: 40,
        price: 35,
        description: 'Ayurvedic tooth powder for relieving tooth sensitivity and gum care.',
        imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
      },
      {
        name: 'Soft Bristle Adult Toothbrush (टूथब्रश)',
        brand: null,
        unit: 'piece',
        size: '1 pc',
        mrp: 30,
        price: 25,
        description: 'Ergonomic grip toothbrush with multi-angle deep clean bristles.',
        imageUrl: 'https://images.unsplash.com/photo-1559591937-e162f2756d11?w=500',
      },
    ],
  },
];

async function main() {
  console.log('Connecting to Neon database...');
  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dns.lookup(config.host!, { all: true });

  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: {
      servername: config.host || undefined,
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  console.log('Database connected successfully.');

  // 1. Locate Ganpati Kirana vendor
  const ganpatiVendorRes = await client.query(
    "SELECT id, business_name, owner_name, type, business_type FROM vendors WHERE business_name ILIKE '%ganpati%' LIMIT 1"
  );
  if (ganpatiVendorRes.rows.length === 0) {
    throw new Error('Ganpati Kirana vendor not found!');
  }
  const ganpatiVendor = ganpatiVendorRes.rows[0];
  console.log(`Found Target Vendor: [${ganpatiVendor.id}] ${ganpatiVendor.business_name} (business_type: ${ganpatiVendor.business_type})`);

  // 2. Locate or ensure Root 'Grocery' category
  let rootGroceryRes = await client.query(
    "SELECT id, name FROM categories WHERE parent_id IS NULL AND (name ILIKE 'Grocery' OR business_type = 'grocery') ORDER BY (business_type = 'grocery') DESC LIMIT 1"
  );
  let rootGroceryId: string;
  if (rootGroceryRes.rows.length === 0) {
    console.log("Root 'Grocery' category not found, creating it...");
    const newRoot = await client.query(
      "INSERT INTO categories (name, business_type, parent_id) VALUES ('Grocery', 'grocery', NULL) RETURNING id, name"
    );
    rootGroceryId = newRoot.rows[0].id;
  } else {
    rootGroceryId = rootGroceryRes.rows[0].id;
    console.log(`Using Root Category: [${rootGroceryId}] ${rootGroceryRes.rows[0].name}`);
  }

  let totalCategoriesCreated = 0;
  let totalCategoriesExisting = 0;
  let totalProductsCreated = 0;
  let totalProductsExisting = 0;
  let totalVendorProductsCreated = 0;
  let totalVendorProductsExisting = 0;

  for (const catData of CATEGORIES_DATA) {
    console.log(`\n======================================================`);
    console.log(`Category: "${catData.name}"`);
    console.log(`======================================================`);

    // Check if category already exists under root or with same name
    let catRes = await client.query(
      'SELECT id, name FROM categories WHERE (parent_id = $1 OR parent_id IS NULL) AND name ILIKE $2 LIMIT 1',
      [rootGroceryId, catData.name]
    );

    let categoryId: string;
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
      totalCategoriesExisting++;
      console.log(`Category exists: [${categoryId}] ${catRes.rows[0].name}`);
    } else {
      const insertedCat = await client.query(
        'INSERT INTO categories (name, business_type, parent_id, image_url) VALUES ($1, $2, $3, $4) RETURNING id, name',
        [catData.name, 'grocery', rootGroceryId, catData.imageUrl]
      );
      categoryId = insertedCat.rows[0].id;
      totalCategoriesCreated++;
      console.log(`Created Category: [${categoryId}] ${insertedCat.rows[0].name}`);
    }

    // Now insert products under this category and link to Ganpati Kirana
    for (const item of catData.items) {
      let prodRes = await client.query(
        'SELECT id, name FROM products WHERE category_id = $1 AND name ILIKE $2 LIMIT 1',
        [categoryId, item.name]
      );

      let productId: string;
      if (prodRes.rows.length > 0) {
        productId = prodRes.rows[0].id;
        totalProductsExisting++;
      } else {
        const insertedProd = await client.query(
          `INSERT INTO products (category_id, brand, name, unit, size, mrp, description, image_url, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
           RETURNING id, name`,
          [
            categoryId,
            item.brand,
            item.name,
            item.unit,
            item.size || null,
            item.mrp,
            item.description,
            item.imageUrl || null,
          ]
        );
        productId = insertedProd.rows[0].id;
        totalProductsCreated++;
      }

      // Link to Ganpati Kirana in vendor_products
      const vpRes = await client.query(
        'SELECT id, price, stock_qty, is_available FROM vendor_products WHERE vendor_id = $1 AND product_id = $2 LIMIT 1',
        [ganpatiVendor.id, productId]
      );

      if (vpRes.rows.length > 0) {
        totalVendorProductsExisting++;
      } else {
        await client.query(
          `INSERT INTO vendor_products (vendor_id, product_id, price, stock_qty, is_available)
           VALUES ($1, $2, $3, $4, true)`,
          [ganpatiVendor.id, productId, item.price, 100]
        );
        totalVendorProductsCreated++;
      }
    }
  }

  console.log(`\n======================================================`);
  console.log('SUMMARY OF OPERATION:');
  console.log(`======================================================`);
  console.log(`Target Vendor: ${ganpatiVendor.business_name} (${ganpatiVendor.id})`);
  console.log(`Categories Created: ${totalCategoriesCreated}, Existing: ${totalCategoriesExisting}`);
  console.log(`Products Created: ${totalProductsCreated}, Existing: ${totalProductsExisting}`);
  console.log(`Vendor Products Linked to Ganpati Kirana: ${totalVendorProductsCreated} new, ${totalVendorProductsExisting} already present`);
  
  // Verify other vendors are untouched
  const otherVendorsRes = await client.query(
    `SELECT v.business_name, count(vp.id) as listing_count
     FROM vendors v
     LEFT JOIN vendor_products vp ON vp.vendor_id = v.id
     WHERE v.id != $1
     GROUP BY v.business_name
     ORDER BY listing_count DESC LIMIT 5`,
    [ganpatiVendor.id]
  );
  console.log('\nSample listing counts for other vendors (verified intact):');
  console.table(otherVendorsRes.rows);

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
