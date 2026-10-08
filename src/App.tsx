import { ROUTE_CHINESE, ROUTE_ENGLISH, ROUTE_HOME, ROUTE_MATH, useHashRoute } from '@/app/routes';
import HomeScreen from '@/features/home/HomeScreen';
import MathApp from '@/features/math/MathApp';
import EnglishHub from '@/features/english/EnglishHub';
import ChinesePlaceholder from '@/features/chinese/ChinesePlaceholder';

export default function App() {
  const route = useHashRoute();
  switch (route) {
    case ROUTE_MATH:
      return <MathApp />;
    case ROUTE_ENGLISH:
      return <EnglishHub />;
    case ROUTE_CHINESE:
      return <ChinesePlaceholder />;
    case ROUTE_HOME:
    default:
      return <HomeScreen />;
  }
}
