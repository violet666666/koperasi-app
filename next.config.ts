

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // Also ignore TS errors if any pop up
  }
};

export default nextConfig;
