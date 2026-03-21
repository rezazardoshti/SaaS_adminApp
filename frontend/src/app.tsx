import RegisterPage from "../src/app/register/page";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <RegisterPage />
    </AuthProvider>
  );
}

export default App;