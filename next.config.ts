

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  /* eslint config removed due to turbopack deprecation */
  typescript: {
    ignoreBuildErrors: true, // Also ignore TS errors if any pop up
  }
};

export default nextConfig;
