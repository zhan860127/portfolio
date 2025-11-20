export interface Product {
  id: number
  title: string
  price: number
  description: string
  image: string
}

export const products: Product[] = [
  {
    id: 1,
    title: 'Minimalist Backpack',
    price: 120,
    description: 'A sleek, durable backpack for your daily commute. Features a padded laptop compartment and water-resistant material.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 2,
    title: 'Wireless Noise-Cancelling Headphones',
    price: 250,
    description: 'Immerse yourself in music with these premium headphones. 30-hour battery life and industry-leading noise cancellation.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 3,
    title: 'Smart Watch Series 5',
    price: 399,
    description: 'Stay connected and healthy with the latest smart watch. Tracks your fitness, heart rate, and sleep patterns.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 4,
    title: 'Mechanical Keyboard',
    price: 150,
    description: 'Experience the tactile satisfaction of a mechanical keyboard. RGB backlighting and customizable switches.',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b91a603?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 5,
    title: 'Polaroid Camera',
    price: 99,
    description: 'Capture memories instantly with this retro-style camera. Includes a pack of film to get you started.',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 6,
    title: 'Ceramic Coffee Mug',
    price: 25,
    description: 'Enjoy your morning brew in this handcrafted ceramic mug. Microwave and dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  }
]
