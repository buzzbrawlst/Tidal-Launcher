using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;

namespace TidalLauncher
{
    public partial class MainWindow : Window
    {
        private const string LOGO_URL =
            "https://github.com/buzzbrawlst/Downloads.Tidal/blob/main/Images/Tidal.png?raw=true";

        private const string HERO_URL =
            "https://assetsio.gnwcdn.com/fortnite-chapter-2-season-3-a.jpg?width=1600&height=900&fit=crop&quality=100&format=png&enable=upscale&auto=png";

        private const string NEWS_FILE = "news.html";


        public MainWindow()
        {
            InitializeComponent();

            LoadImages();
            SetupNewsBrowser();
        }


        private void LoadImages()
        {
            try
            {
                HeroImage.Source = new BitmapImage(
                    new Uri(HERO_URL)
                );
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex.Message);
            }
        }


        private async void SetupNewsBrowser()
        {
            try
            {
                await NewsBrowser.EnsureCoreWebView2Async();

                string path = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    NEWS_FILE
                );

                if (File.Exists(path))
                {
                    NewsBrowser.Source = new Uri(
                        path,
                        UriKind.Absolute
                    );
                }
                else
                {
                    MessageBox.Show(
                        "news.html was not found.\n\n" +
                        "Place news.html next to the launcher executable.",
                        "Tidal News",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning
                    );
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Could not load the news page.\n\n" +
                    ex.Message,
                    "Tidal Launcher",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }


        private void HomeButton_Click(
            object sender,
            RoutedEventArgs e)
        {
            HomePanel.Visibility = Visibility.Visible;
            NewsPanel.Visibility = Visibility.Collapsed;
        }


        private void NewsButton_Click(
            object sender,
            RoutedEventArgs e)
        {
            HomePanel.Visibility = Visibility.Collapsed;
            NewsPanel.Visibility = Visibility.Visible;
        }


        private void DiscordButton_Click(
            object sender,
            RoutedEventArgs e)
        {
            try
            {
                Process.Start(
                    new ProcessStartInfo
                    {
                        FileName = "https://discord.com",
                        UseShellExecute = true
                    }
                );
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    ex.Message,
                    "Discord",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }


        private void LaunchButton_Click(
            object sender,
            RoutedEventArgs e)
        {
            MessageBox.Show(
                "Tidal launch system is not connected yet.",
                "Tidal Launcher",
                MessageBoxButton.OK,
                MessageBoxImage.Information
            );
        }
    }
}